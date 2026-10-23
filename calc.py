"""ctypes wrapper around libnspire for talking to a TI-Nspire over USB."""
import ctypes as C
import io
import os
import threading
import ctypes.util
from pathlib import Path

import paths

TI_VID = "0451"
TI_PIDS = {"e012": "TI-Nspire CX / CX CAS", "e022": "TI-Nspire CX II / CX II CAS"}


class Error(Exception):
    pass


class _Ver(C.Structure):
    _fields_ = [("major", C.c_uint8), ("minor", C.c_uint8), ("build", C.c_uint16)]


class _Pair(C.Structure):
    _fields_ = [("free", C.c_uint64), ("total", C.c_uint64)]


class _Batt(C.Structure):
    _fields_ = [("status", C.c_int), ("is_charging", C.c_uint8)]


class _Lcd(C.Structure):
    _fields_ = [("width", C.c_uint16), ("height", C.c_uint16),
                ("bbp", C.c_uint8), ("sample_mode", C.c_uint8)]


class _Ext(C.Structure):
    _fields_ = [("file", C.c_char * 8), ("os", C.c_char * 8)]


class _DevInfo(C.Structure):
    _fields_ = [("storage", _Pair), ("ram", _Pair), ("versions", _Ver * 3),
                ("hw_type", C.c_int), ("batt", _Batt), ("clock_speed", C.c_uint8),
                ("lcd", _Lcd), ("extensions", _Ext), ("device_name", C.c_char * 20),
                ("electronic_id", C.c_char * 28), ("runlevel", C.c_int)]


class _DirItem(C.Structure):
    _fields_ = [("name", C.c_char * 240), ("size", C.c_ulong), ("date", C.c_ulong),
                ("type", C.c_int)]


class _DirInfoHead(C.Structure):
    _fields_ = [("num", C.c_ulong)]


class _ImageHead(C.Structure):
    _fields_ = [("width", C.c_uint16), ("height", C.c_uint16), ("bpp", C.c_uint8)]


HW_NAMES = {0x0E: "TI-Nspire CAS", 0x1E: "TI-Nspire", 0x0F: "TI-Nspire CX CAS",
            0x1F: "TI-Nspire CX"}
BATT_NAMES = {0x00: "USB powered", 0xF1: "Low", 0x7F: "OK", 0xFF: "Unknown"}


def _load():
    lp = paths.libnspire_path()
    if paths.WINDOWS:
        os.add_dll_directory(str(lp.parent))  # libusb / mingw runtime DLLs sit beside it
    lib = C.CDLL(str(lp))
    vp = C.c_void_p
    lib.nspire_init.argtypes = [C.POINTER(vp)]
    lib.nspire_free.argtypes = [vp]
    lib.nspire_strerror.restype = C.c_char_p
    lib.nspire_device_info.argtypes = [vp, C.POINTER(_DevInfo)]
    lib.nspire_dirlist.argtypes = [vp, C.c_char_p, C.POINTER(vp)]
    lib.nspire_dirlist_free.argtypes = [vp]
    lib.nspire_dir_create.argtypes = [vp, C.c_char_p]
    lib.nspire_dir_delete.argtypes = [vp, C.c_char_p]
    lib.nspire_attr.argtypes = [vp, C.c_char_p, C.POINTER(_DirItem)]
    lib.nspire_file_write.argtypes = [vp, C.c_char_p, C.c_void_p, C.c_size_t]
    lib.nspire_file_read.argtypes = [vp, C.c_char_p, C.c_void_p, C.c_size_t,
                                     C.POINTER(C.c_size_t)]
    lib.nspire_file_move.argtypes = [vp, C.c_char_p, C.c_char_p]
    lib.nspire_file_delete.argtypes = [vp, C.c_char_p]
    lib.nspire_screenshot.argtypes = [vp, C.POINTER(vp)]
    return lib


class _UsbDesc(C.Structure):
    _fields_ = [("bLength", C.c_uint8), ("bDescriptorType", C.c_uint8), ("bcdUSB", C.c_uint16),
                ("bDeviceClass", C.c_uint8), ("bDeviceSubClass", C.c_uint8),
                ("bDeviceProtocol", C.c_uint8), ("bMaxPacketSize0", C.c_uint8),
                ("idVendor", C.c_uint16), ("idProduct", C.c_uint16), ("bcdDevice", C.c_uint16),
                ("iManufacturer", C.c_uint8), ("iProduct", C.c_uint8),
                ("iSerialNumber", C.c_uint8), ("bNumConfigurations", C.c_uint8)]


_libusb = None


def _detect_libusb():
    """Enumerate USB devices through libusb (used where /sys is not available)."""
    global _libusb
    if _libusb is None:
        p = paths.libusb_path() or ctypes.util.find_library("usb-1.0")
        if paths.WINDOWS and p:
            os.add_dll_directory(str(Path(p).parent))
        _libusb = C.CDLL(str(p)) if p else False
        if _libusb:
            _libusb.libusb_get_device_list.restype = C.c_ssize_t
            _libusb.libusb_get_device_list.argtypes = [C.c_void_p, C.c_void_p]
            _libusb.libusb_init.argtypes = [C.c_void_p]
            _libusb.libusb_exit.argtypes = [C.c_void_p]
            _libusb.libusb_free_device_list.argtypes = [C.c_void_p, C.c_int]
    if not _libusb:
        return None
    ctx, lst = C.c_void_p(), C.POINTER(C.c_void_p)()
    if _libusb.libusb_init(C.byref(ctx)) != 0:
        return None
    try:
        n = _libusb.libusb_get_device_list(ctx, C.byref(lst))
        try:
            for i in range(max(n, 0)):
                d = _UsbDesc()
                if _libusb.libusb_get_device_descriptor(C.c_void_p(lst[i]), C.byref(d)) == 0:
                    pid = f"{d.idProduct:04x}"
                    if d.idVendor == 0x0451 and pid in TI_PIDS:
                        return {"model": TI_PIDS[pid], "pid": pid, "node": None, "writable": True}
        finally:
            if n > 0:
                _libusb.libusb_free_device_list(lst, 1)
    finally:
        _libusb.libusb_exit(ctx)
    return None


def detect_usb():
    """Look for a TI-Nspire on the USB bus without opening it."""
    if not Path("/sys/bus/usb/devices").is_dir():
        try:
            return _detect_libusb()
        except OSError:
            return None
    for dev in Path("/sys/bus/usb/devices").glob("*"):
        try:
            vid = (dev / "idVendor").read_text().strip()
            pid = (dev / "idProduct").read_text().strip()
        except OSError:
            continue
        if vid == TI_VID and pid in TI_PIDS:
            node = None
            try:
                bus = int((dev / "busnum").read_text())
                num = int((dev / "devnum").read_text())
                node = f"/dev/bus/usb/{bus:03d}/{num:03d}"
            except (OSError, ValueError):
                pass
            return {"model": TI_PIDS[pid], "pid": pid, "node": node,
                    "writable": bool(node and os.access(node, os.R_OK | os.W_OK))}
    return None


def _libc_free(ptr):
    # On Windows the DLL may use a different C runtime heap; a small leak is safer there.
    if not paths.WINDOWS:
        C.CDLL(None).free(ptr)


class Calculator:
    """One shared connection; every libnspire call goes through a lock."""

    def __init__(self):
        self.lib = _load()
        self.handle = None
        self.lock = threading.RLock()
        self.info_cache = None

    # -- helpers --------------------------------------------------------
    def _check(self, ret, what):
        if ret != 0:
            msg = self.lib.nspire_strerror(ret).decode(errors="replace")
            # USB-level failures mean the cable was pulled or the calc slept.
            if -ret in (1, 4, 5):
                self._drop()
            raise Error(f"{what}: {msg}")

    def _drop(self):
        if self.handle:
            try:
                self.lib.nspire_free(self.handle)
            except Exception:
                pass
        self.handle = None
        self.info_cache = None

    def _need(self):
        if not self.handle:
            raise Error("Calculator is not connected")
        return self.handle

    @staticmethod
    def _p(path):
        return path.encode("utf-8")

    # -- connection -----------------------------------------------------
    @property
    def connected(self):
        return self.handle is not None

    def connect(self):
        with self.lock:
            if self.handle:
                return self.info()
            h = C.c_void_p()
            ret = self.lib.nspire_init(C.byref(h))
            if ret != 0:
                msg = self.lib.nspire_strerror(ret).decode(errors="replace")
                usb = detect_usb()
                if usb and not usb["writable"]:
                    msg += " (no permission on the USB device; install the udev rule: sudo ./install-udev.sh)"
                elif not usb:
                    msg += " (no calculator found on USB; make sure it is on and unlocked)"
                elif paths.WINDOWS:
                    msg += (" (on Windows the calculator needs the WinUSB driver: see the README,"
                            " 'Windows USB driver')")
                raise Error(f"Connect failed: {msg}")
            self.handle = h
            return self.info(refresh=True)

    def disconnect(self):
        with self.lock:
            self._drop()

    def info(self, refresh=False):
        with self.lock:
            if self.info_cache and not refresh:
                return self.info_cache
            d = _DevInfo()
            self._check(self.lib.nspire_device_info(self._need(), C.byref(d)), "Device info")
            v = d.versions
            dev_name = d.device_name.decode(errors="replace")
            name = HW_NAMES.get(d.hw_type)
            if dev_name.startswith("TI-Nspire"):
                name = dev_name  # CX II reports its model here (hw_type 0x1C etc.)
            elif not name:
                usb = detect_usb()
                name = usb["model"] if usb else f"TI-Nspire (type {d.hw_type:#x})"
            self.info_cache = {
                "model": name,
                "name": d.device_name.decode(errors="replace"),
                "id": d.electronic_id.decode(errors="replace"),
                "os": f"{v[0].major}.{v[0].minor}.{v[0].build}",
                "boot2": f"{v[2].major}.{v[2].minor}.{v[2].build}",
                "storage_free": d.storage.free, "storage_total": d.storage.total,
                "ram_free": d.ram.free, "ram_total": d.ram.total,
                "battery": BATT_NAMES.get(d.batt.status, "Unknown"),
                "battery_raw": d.batt.status,
                "charging": bool(d.batt.is_charging),
                "lcd": [d.lcd.width, d.lcd.height, d.lcd.bbp],
                "ext": d.extensions.file.decode(errors="replace"),
            }
            return self.info_cache

    # -- file system ----------------------------------------------------
    def listdir(self, path):
        with self.lock:
            ptr = C.c_void_p()
            self._check(self.lib.nspire_dirlist(self._need(), self._p(path), C.byref(ptr)),
                        f"List {path}")
            try:
                num = _DirInfoHead.from_address(ptr.value).num
                base = ptr.value + C.sizeof(C.c_ulong)
                items = (_DirItem * num).from_address(base)
                out = []
                for it in items:
                    name = it.name.decode("utf-8", errors="replace")
                    if name in (".", ".."):
                        continue
                    out.append({"name": name, "size": it.size, "date": it.date,
                                "dir": it.type == 1})
            finally:
                self.lib.nspire_dirlist_free(ptr)
            out.sort(key=lambda e: (not e["dir"], e["name"].lower()))
            return out

    def stat(self, path):
        with self.lock:
            it = _DirItem()
            self._check(self.lib.nspire_attr(self._need(), self._p(path), C.byref(it)),
                        f"Stat {path}")
            return {"size": it.size, "date": it.date, "dir": it.type == 1}

    def exists(self, path):
        try:
            self.stat(path)
            return True
        except Error:
            return False

    def read(self, path):
        with self.lock:
            size = self.stat(path)["size"]
            buf = C.create_string_buffer(max(size, 1))
            got = C.c_size_t()
            self._check(self.lib.nspire_file_read(self._need(), self._p(path), buf, size,
                                                  C.byref(got)), f"Read {path}")
            return buf.raw[:got.value]

    def write(self, path, data):
        with self.lock:
            buf = C.create_string_buffer(data, len(data))
            self._check(self.lib.nspire_file_write(self._need(), self._p(path), buf, len(data)),
                        f"Write {path}")

    def mkdir(self, path):
        with self.lock:
            self._check(self.lib.nspire_dir_create(self._need(), self._p(path)), f"Create {path}")

    def makedirs(self, path):
        parts = [p for p in path.split("/") if p]
        cur = ""
        for p in parts:
            cur += "/" + p
            if not self.exists(cur):
                self.mkdir(cur)

    def delete(self, path, is_dir=False):
        with self.lock:
            fn = self.lib.nspire_dir_delete if is_dir else self.lib.nspire_file_delete
            self._check(fn(self._need(), self._p(path)), f"Delete {path}")

    def move(self, src, dst):
        with self.lock:
            self._check(self.lib.nspire_file_move(self._need(), self._p(src), self._p(dst)),
                        f"Move {src}")

    def screenshot_png(self):
        from PIL import Image
        with self.lock:
            ptr = C.c_void_p()
            self._check(self.lib.nspire_screenshot(self._need(), C.byref(ptr)), "Screenshot")
            try:
                head = _ImageHead.from_address(ptr.value)
                w, h, bpp = head.width, head.height, head.bpp
                # struct is {u16,u16,u8} then flexible data; offset is 5 bytes
                n = w * h * bpp // 8
                raw = C.string_at(ptr.value + 5, n)
            finally:
                _libc_free(ptr)
        if bpp == 16:
            img = Image.frombuffer("RGB", (w, h), raw, "raw", "BGR;16", 0, 1)
        elif bpp == 4:
            img = Image.frombuffer("L", (w, h), bytes(
                ((b >> 4) * 17 if i % 2 == 0 else (b & 15) * 17)
                for b in raw for i in range(2)), "raw", "L", 0, 1)
        else:
            img = Image.frombuffer("L", (w, h), raw, "raw", "L", 0, 1)
        out = io.BytesIO()
        img.save(out, "PNG")
        return out.getvalue()
