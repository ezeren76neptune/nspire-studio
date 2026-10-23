#!/usr/bin/env python3
"""Nspire Studio desktop app: the editor in its own native window (Qt WebEngine)."""
import json
import os
import sys
from pathlib import Path

from PySide6.QtCore import QTimer, QUrl, Qt
from PySide6.QtGui import QGuiApplication, QIcon, QKeySequence, QShortcut
from PySide6.QtNetwork import QLocalServer, QLocalSocket
from PySide6.QtWebEngineCore import QWebEngineDownloadRequest, QWebEnginePage, QWebEngineProfile
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWidgets import QApplication, QFileDialog, QMainWindow, QMessageBox

sys.path.insert(0, str(Path(__file__).resolve().parent))
import paths  # noqa: E402
import server  # noqa: E402

APP_ID = "nspire-studio"
ICON = str(paths.STATIC / "icon.svg")
try:
    import getpass
    INSTANCE_KEY = f"{APP_ID}-{getpass.getuser()}"
except Exception:
    INSTANCE_KEY = APP_ID


class Page(QWebEnginePage):
    def acceptNavigationRequest(self, url, nav_type, is_main_frame):
        # Keep the window on the app; open any external link in the real browser.
        if url.host() not in ("127.0.0.1", "localhost") and url.scheme() in ("http", "https"):
            from PySide6.QtGui import QDesktopServices
            QDesktopServices.openUrl(url)
            return False
        return super().acceptNavigationRequest(url, nav_type, is_main_frame)


class Window(QMainWindow):
    def __init__(self, url):
        super().__init__()
        self.setWindowTitle("Nspire Studio")
        self.setWindowIcon(QIcon(ICON))
        self.resize(1500, 920)
        self.closing = False

        self.profile = QWebEngineProfile(APP_ID, self)  # persistent: keeps localStorage
        self.profile.setPersistentStoragePath(str(paths.DATA / "web"))
        self.profile.downloadRequested.connect(self.on_download)
        self.view = QWebEngineView(self)
        self.view.setPage(Page(self.profile, self.view))
        self.view.setUrl(QUrl(url))
        self.setCentralWidget(self.view)
        self.ready = False
        self.pending = []
        self.view.loadFinished.connect(self.on_loaded)

        QShortcut(QKeySequence("F5"), self, self.view.reload)
        QShortcut(QKeySequence("Ctrl+Q"), self, self.close)
        QShortcut(QKeySequence("Ctrl+="), self, lambda: self.zoom(0.1))
        QShortcut(QKeySequence("Ctrl+-"), self, lambda: self.zoom(-0.1))
        QShortcut(QKeySequence("Ctrl+0"), self, lambda: self.view.setZoomFactor(1.0))

    def on_loaded(self, ok):
        self.ready = ok
        if ok:
            QTimer.singleShot(1500, self.flush_files)  # let the page finish booting

    def open_files(self, files):
        self.pending += [f for f in files if f]
        if self.ready:
            self.flush_files()

    def flush_files(self):
        while self.pending:
            p = Path(self.pending.pop(0))
            try:
                text = p.read_text(encoding="utf-8")
            except OSError as e:
                QMessageBox.warning(self, "Nspire Studio", f"Could not open {p}:\n{e}")
                continue
            self.view.page().runJavaScript(
                f"window.openFileText && openFileText({json.dumps(text)}, {json.dumps(p.name)})")

    def zoom(self, d):
        self.view.setZoomFactor(max(0.5, min(2.5, self.view.zoomFactor() + d)))

    def on_download(self, dl: QWebEngineDownloadRequest):
        start = Path.home() / "Downloads"
        if not start.is_dir():
            start = Path.home()
        path, _ = QFileDialog.getSaveFileName(self, "Save file", str(start / dl.downloadFileName()))
        if not path:
            dl.cancel()
            return
        p = Path(path)
        dl.setDownloadDirectory(str(p.parent))
        dl.setDownloadFileName(p.name)
        dl.isFinishedChanged.connect(
            lambda: dl.state() == QWebEngineDownloadRequest.DownloadCompleted
            and self.statusBar().showMessage(f"Saved {p}", 5000))
        dl.accept()

    def raise_window(self):
        self.setWindowState(self.windowState() & ~Qt.WindowMinimized)
        self.show()
        self.raise_()
        self.activateWindow()

    def closeEvent(self, ev):
        if self.closing:
            ev.accept()
            return
        # Let the page flush its autosave before the window goes away.
        self.closing = True
        ev.ignore()
        self.view.page().runJavaScript("typeof saveNow === 'function' && doc && saveNow(); 1")
        QTimer.singleShot(500, self.close)


def main():
    if paths.WINDOWS:
        import ctypes
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("NspireStudio.App")
    QGuiApplication.setDesktopFileName(APP_ID)
    os.environ.setdefault("QTWEBENGINE_CHROMIUM_FLAGS", "--disable-logging")
    app = QApplication(sys.argv)
    app.setApplicationName("Nspire Studio")
    app.setWindowIcon(QIcon(ICON))

    # Single instance: if it's already open, bring that window forward.
    files = [str(Path(a).resolve()) for a in sys.argv[1:] if not a.startswith("-") and Path(a).is_file()]
    sock = QLocalSocket()
    sock.connectToServer(INSTANCE_KEY)
    if sock.waitForConnected(300):
        sock.write(json.dumps({"open": files}).encode())
        sock.waitForBytesWritten(1000)
        return 0
    QLocalServer.removeServer(INSTANCE_KEY)
    instance = QLocalServer()
    instance.listen(INSTANCE_KEY)

    try:
        try:
            srv, url = server.start_background(47615)  # fixed port keeps app storage stable
        except OSError:
            srv, url = server.start_background(0)
    except OSError as e:
        QMessageBox.critical(None, "Nspire Studio", f"Could not start: {e}")
        return 1

    win = Window(url)

    def on_instance():
        conn = instance.nextPendingConnection()
        if not conn.bytesAvailable():
            conn.waitForReadyRead(1000)
        try:
            msg = json.loads(bytes(conn.readAll()).decode() or "{}")
        except ValueError:
            msg = {}
        conn.disconnectFromServer()
        win.raise_window()
        win.open_files(msg.get("open", []))
    instance.newConnection.connect(on_instance)
    win.show()
    win.open_files(files)

    def shutdown():
        server.CALC.disconnect()
        srv.shutdown()
    app.aboutToQuit.connect(shutdown)
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
