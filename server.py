#!/usr/bin/env python3
"""Nspire Studio: local web app for building notes and sending them to a TI-Nspire."""
import json
import mimetypes
import re
import sys
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse, quote

import builder
import calc
import paths

STATIC = paths.STATIC
PROJECTS = paths.PROJECTS
PORT = 8765

CALC = calc.Calculator()


def safe_id(s):
    s = re.sub(r"[^A-Za-z0-9_-]", "", s or "")
    if not s:
        raise ValueError("bad id")
    return s


def tns_name(name):
    name = re.sub(r'[\\/:*?"<>|]', "", (name or "").strip()) or "notes"
    return name if name.lower().endswith(".tns") else name + ".tns"


def join(folder, name):
    folder = "/" + "/".join(p for p in (folder or "").split("/") if p)
    return (folder.rstrip("/") + "/" + name) if folder != "/" else "/" + name


class Handler(BaseHTTPRequestHandler):
    server_version = "NspireStudio/1.0"

    def log_message(self, fmt, *args):
        if "/api/status" not in str(args[0] if args else ""):
            sys.stderr.write("%s\n" % (fmt % args))

    # -- responses ------------------------------------------------------
    def send(self, code, body, ctype="application/json", headers=None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body).encode()
        elif isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def ok(self, data=None):
        self.send(200, {"ok": True, **(data or {})})

    def fail(self, msg, code=400):
        self.send(code, {"ok": False, "error": str(msg)})

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n) if n else b""

    def json(self):
        return json.loads(self.body() or b"{}")

    # -- routing --------------------------------------------------------
    def do_GET(self):
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        try:
            if u.path.startswith("/api/"):
                return self.api_get(u.path[5:], q)
            return self.static(u.path)
        except (calc.Error, builder.BuildError, ValueError, OSError) as e:
            self.fail(e)

    def do_POST(self):
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        try:
            return self.api_post(u.path[5:], q)
        except (calc.Error, builder.BuildError, ValueError, OSError, KeyError) as e:
            self.fail(e)

    def static(self, path):
        if path in ("", "/"):
            path = "/index.html"
        f = (STATIC / path.lstrip("/")).resolve()
        if not f.is_relative_to(STATIC.resolve()) or not f.is_file():
            return self.send(404, "not found", "text/plain")
        ctype = mimetypes.guess_type(f.name)[0] or "application/octet-stream"
        self.send(200, f.read_bytes(), ctype)

    def api_get(self, ep, q):
        if ep == "status":
            usb = calc.detect_usb()
            info = None
            if CALC.connected and not usb:
                CALC.disconnect()
            if CALC.connected:
                info = CALC.info_cache
            return self.ok({"usb": usb, "connected": CALC.connected, "info": info})
        if ep == "ls":
            return self.ok({"items": CALC.listdir(q.get("path", "/"))})
        if ep == "download":
            path = q["path"]
            data = CALC.read(path)
            name = path.rsplit("/", 1)[-1]
            return self.send(200, data, "application/octet-stream",
                             {"Content-Disposition": f"attachment; filename*=UTF-8''{quote(name)}"})
        if ep == "screenshot":
            return self.send(200, CALC.screenshot_png(), "image/png")
        if ep == "projects":
            out = []
            for f in sorted(PROJECTS.glob("*.json"), key=lambda p: -p.stat().st_mtime):
                try:
                    d = json.loads(f.read_text())
                    out.append({"id": f.stem, "title": d.get("title", f.stem),
                                "modified": f.stat().st_mtime})
                except (OSError, json.JSONDecodeError):
                    pass
            return self.ok({"projects": out})
        if ep == "project":
            f = PROJECTS / (safe_id(q["id"]) + ".json")
            return self.send(200, f.read_bytes())
        self.fail("unknown endpoint", 404)

    def api_post(self, ep, q):
        if ep == "connect":
            return self.ok({"info": CALC.connect()})
        if ep == "disconnect":
            CALC.disconnect()
            return self.ok()
        if ep == "refresh":
            return self.ok({"info": CALC.info(refresh=True)})
        if ep == "upload":
            CALC.write(q["path"], self.body())
            return self.ok()
        if ep == "mkdir":
            CALC.mkdir(self.json()["path"])
            return self.ok()
        if ep == "delete":
            d = self.json()
            CALC.delete(d["path"], bool(d.get("dir")))
            return self.ok()
        if ep == "move":
            d = self.json()
            CALC.move(d["src"], d["dst"])
            return self.ok()
        if ep == "project":
            d = self.json()
            pid = safe_id(d.get("id"))
            d["saved"] = time.time()
            (PROJECTS / (pid + ".json")).write_text(json.dumps(d))
            return self.ok({"id": pid})
        if ep == "project-delete":
            f = PROJECTS / (safe_id(self.json()["id"]) + ".json")
            f.unlink(missing_ok=True)
            return self.ok()
        if ep == "build":
            d = self.json()
            data = builder.build_tns(d["doc"])
            name = tns_name(d.get("name") or d["doc"].get("title"))
            return self.send(200, data, "application/octet-stream",
                             {"Content-Disposition": f"attachment; filename*=UTF-8''{quote(name)}"})
        if ep == "lua":
            return self.send(200, builder.build_lua(self.json()["doc"]), "text/plain; charset=utf-8")
        if ep == "send":
            d = self.json()
            data = builder.build_tns(d["doc"])
            name = tns_name(d.get("name") or d["doc"].get("title"))
            folder = d.get("folder") or "/"
            if not CALC.connected:
                CALC.connect()
            if folder.strip("/"):
                CALC.makedirs(folder)
            path = join(folder, name)
            if CALC.exists(path):
                if not d.get("overwrite"):
                    return self.send(409, {"ok": False, "exists": True, "path": path,
                                           "error": f"{path} already exists"})
                CALC.delete(path)
            CALC.write(path, data)
            return self.ok({"path": path, "size": len(data)})
        self.fail("unknown endpoint", 404)


def start_background(port=0):
    """Run the server on a private port in a daemon thread; returns its URL."""
    import threading
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}/"


def main():
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = f"http://127.0.0.1:{PORT}/"
    print(f"Nspire Studio running at {url}")
    if "--no-browser" not in sys.argv:
        webbrowser.open(url)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        CALC.disconnect()


if __name__ == "__main__":
    main()
