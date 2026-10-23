"""Where Nspire Studio finds its bundled files and keeps the user's documents."""
import os
import sys
from pathlib import Path

WINDOWS = sys.platform.startswith("win")

# Read-only resources: next to the code, or inside a PyInstaller bundle.
RES = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
STATIC = RES / "static"
RUNTIME_LUA = RES / "runtime.lua"


def data_dir():
    if WINDOWS:
        base = Path(os.environ.get("APPDATA") or Path.home() / "AppData" / "Roaming")
        d = base / "NspireStudio"
    else:
        base = Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local" / "share")
        d = base / "nspire-studio"
    d.mkdir(parents=True, exist_ok=True)
    return d


DATA = data_dir()
PROJECTS = DATA / "projects"
PROJECTS.mkdir(exist_ok=True)


def _migrate_legacy():
    """Early builds kept documents in ./projects next to the code; move newer copies over."""
    old = RES / "projects"
    if not old.is_dir():
        return
    import shutil
    for f in old.glob("*.json"):
        dst = PROJECTS / f.name
        if not dst.exists() or f.stat().st_mtime > dst.stat().st_mtime:
            shutil.copy2(f, dst)
    shutil.rmtree(old, ignore_errors=True)


_migrate_legacy()

# Native helpers (libnspire, Luna) built by scripts/build-native.sh
_NATIVE_DIRS = [Path(os.environ["NSPIRE_NATIVE"])] if os.environ.get("NSPIRE_NATIVE") else []
_NATIVE_DIRS += [RES / "native", RES / "vendor" / "build" / "lib", RES / "vendor" / "luna"]


def find_native(*names):
    for d in _NATIVE_DIRS:
        for n in names:
            if (d / n).exists():
                return d / n
    return None


def libnspire_path():
    names = ("libnspire-0.dll", "nspire.dll") if WINDOWS else ("libnspire.so", "libnspire.so.0")
    p = find_native(*names)
    if p is None:
        raise OSError("libnspire not found; run scripts/build-native.sh")
    return p


def luna_path():
    p = find_native("luna.exe" if WINDOWS else "luna")
    if p is None:
        raise OSError("Luna not found; run scripts/build-native.sh")
    return p


def libusb_path():
    return find_native("libusb-1.0.dll" if WINDOWS else "libusb-1.0.so.0")
