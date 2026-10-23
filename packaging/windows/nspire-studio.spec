# PyInstaller spec for the Windows build (run from the repo root after scripts/build-native.sh)
from pathlib import Path

root = Path(SPECPATH).parents[1]
excl = ["PySide6.Qt3DCore", "PySide6.Qt3DRender", "PySide6.Qt3DInput", "PySide6.Qt3DLogic",
        "PySide6.Qt3DAnimation", "PySide6.Qt3DExtras", "PySide6.QtCharts", "PySide6.QtDataVisualization",
        "PySide6.QtGraphs", "PySide6.QtMultimedia", "PySide6.QtMultimediaWidgets", "PySide6.QtBluetooth",
        "PySide6.QtNfc", "PySide6.QtSensors", "PySide6.QtSerialPort", "PySide6.QtSerialBus",
        "PySide6.QtSql", "PySide6.QtTest", "PySide6.QtDesigner", "PySide6.QtHelp", "PySide6.QtUiTools",
        "PySide6.QtRemoteObjects", "PySide6.QtScxml", "PySide6.QtSpatialAudio", "PySide6.QtTextToSpeech",
        "PySide6.QtHttpServer", "PySide6.QtLocation", "tkinter", "unittest"]

a = Analysis(
    [str(root / "app.py")],
    pathex=[str(root)],
    datas=[(str(root / "static"), "static"), (str(root / "runtime.lua"), "."),
           (str(root / "native"), "native")],
    hiddenimports=["server", "calc", "builder", "paths"],
    excludes=excl,
)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name="NspireStudio",
          icon=str(root / "packaging/windows/nspire-studio.ico"), console=False,
          version=str(root / "packaging/windows/version.txt"))
coll = COLLECT(exe, a.binaries, a.datas, name="NspireStudio")
