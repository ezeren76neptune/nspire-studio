"""Smoke test: imports, Qt WebEngine, libnspire loading and a full .tns build.
Usage: python3 smoke-test.py [app dir]   (default: the installed /usr/lib/nspire-studio)"""
import sys
sys.path.insert(0, sys.argv[1] if len(sys.argv) > 1 else "/usr/lib/nspire-studio")
import builder, calc, server  # noqa: E401
from PySide6.QtWebEngineWidgets import QWebEngineView  # noqa: F401
from PySide6.QtSvg import QSvgRenderer  # noqa: F401
doc = {"title": "t", "tabs": [{"name": "A", "items": [
    {"type": "heading", "text": "Hi"},
    {"type": "input", "label": "a", "var": "a", "value": "2"},
    {"type": "output", "label": "b", "expr": "a*2"}]}]}
data = builder.build_tns(doc)
assert data[:6] == b"*TIMLP", data[:16]
print("calc detect:", calc.detect_usb(), "| tns bytes:", len(data))
calc.Calculator()  # loads libnspire
print("SMOKE TEST OK")
