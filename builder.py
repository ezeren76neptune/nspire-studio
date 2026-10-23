"""Turn an editor document (JSON) into a .tns: runtime.lua + DOC table, packed by Luna."""
import base64
import io
import re
import struct
import subprocess
import tempfile
import uuid
from pathlib import Path

from PIL import Image

import paths

RUNTIME = paths.RUNTIME_LUA
CONTENT_W = 318 - 2 * 4 - 3  # must match W - 2*PAD - SBW in runtime.lua


class BuildError(Exception):
    pass


def lua_str(s):
    s = str(s)
    out = ['"']
    for ch in s:
        o = ord(ch)
        if ch == "\\":
            out.append("\\\\")
        elif ch == '"':
            out.append('\\"')
        elif ch == "\n":
            out.append("\\n")
        elif o < 32 or o == 127:
            out.append("\\%03d" % o)
        else:
            out.append(ch)
    out.append('"')
    return "".join(out)


def lua_val(v):
    if v is None:
        return "nil"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v) if isinstance(v, int) else ("%.10g" % v)
    if isinstance(v, str):
        return lua_str(v)
    if isinstance(v, list):
        return "{" + ",".join(lua_val(x) for x in v) + "}"
    if isinstance(v, dict):
        parts = []
        for k, x in v.items():
            if x is None:
                continue
            key = k if re.match(r"^[A-Za-z_]\w*$", k) else "[" + lua_str(k) + "]"
            parts.append(f"{key}={lua_val(x)}")
        return "{" + ",".join(parts) + "}"
    raise BuildError(f"cannot encode {type(v)}")


def hex_color(s, default):
    if not s:
        return default
    s = s.lstrip("#")
    try:
        return int(s[:6], 16)
    except ValueError:
        return default


def png_to_tiimage(data_url, bg):
    """PNG data URL -> base64 of TI.Image header + PackBits-compressed RGB555 pixels."""
    raw = base64.b64decode(data_url.split(",", 1)[1])
    img = Image.open(io.BytesIO(raw)).convert("RGBA")
    if img.width > CONTENT_W:
        img = img.resize((CONTENT_W, max(1, round(img.height * CONTENT_W / img.width))),
                         Image.LANCZOS)
    base = Image.new("RGBA", img.size, ((bg >> 16) & 255, (bg >> 8) & 255, bg & 255, 255))
    img = Image.alpha_composite(base, img).convert("RGB")
    w, h = img.size
    px = []
    for r, g, b in img.getdata():
        px.append(0x8000 | ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3))
    header = struct.pack("<IIIIHH", w, h, 0, w * 2, 16, 1)
    out = bytearray(header)
    i, n = 0, len(px)
    while i < n:
        j = i
        while j + 1 < n and px[j + 1] == px[i] and j - i < 128:
            j += 1
        run = j - i + 1
        if run >= 2:
            out.append(126 + run)  # 128..254 -> repeat 2..128
            out += struct.pack("<H", px[i])
            i = j + 1
            continue
        # literal block: until a run of 2 begins or 128 pixels
        j = i
        while j < n and j - i < 128 and not (j + 1 < n and px[j + 1] == px[j]):
            j += 1
        if j == i:
            j = i + 1
        out.append(j - i - 1)
        for p in px[i:j]:
            out += struct.pack("<H", p)
        i = j
    return base64.b64encode(bytes(out)).decode("ascii"), w, h


def ti_expr(s):
    """Small translations from friendly syntax to TI syntax."""
    s = (s or "").strip()
    s = re.sub(r"\bpi\b", "π", s)
    s = s.replace("**", "^")
    return s


def num(v, d):
    try:
        return float(v)
    except (TypeError, ValueError):
        return d


def convert(doc):
    theme = doc.get("theme", {})
    bg = hex_color(theme.get("bg"), 0xFFFFFF)
    out = {
        "id": doc.get("id") or uuid.uuid4().hex[:8],
        "angle": doc.get("angle", "rad"),
        "theme": {
            "bg": bg,
            "fg": hex_color(theme.get("fg"), 0x111111),
            "accent": hex_color(theme.get("accent"), 0x2A6FDB),
            "tabbg": hex_color(theme.get("tabbg"), 0x2B3442),
            "tabfg": hex_color(theme.get("tabfg"), 0xC9D2DE),
        },
        "tabs": [],
    }
    tabs = doc.get("tabs") or []
    if not tabs:
        raise BuildError("The document has no tabs")
    for tab in tabs:
        items = []
        for e in tab.get("items", []):
            t = e.get("type")
            if t == "heading":
                items.append({"t": "h", "text": e.get("text", ""), "size": int(e.get("size", 12)),
                              "color": hex_color(e.get("color"), None), "align": e.get("align")})
            elif t == "text":
                items.append({"t": "p", "text": e.get("text", ""), "size": int(e.get("size", 10)),
                              "style": e.get("style", "r"), "color": hex_color(e.get("color"), None),
                              "align": e.get("align")})
            elif t in ("equation", "image"):
                if not e.get("raster"):
                    continue
                data, w, h = png_to_tiimage(e["raster"], bg)
                items.append({"t": "eq" if t == "equation" else "img", "w": w, "h": h,
                              "data": data, "align": e.get("align", "left")})
            elif t == "graph":
                fns = [{"expr": ti_expr(f.get("expr")), "color": hex_color(f.get("color"), 0x1060D0)}
                       for f in e.get("fns", []) if (f.get("expr") or "").strip()]
                xmin, xmax = num(e.get("xmin"), -10), num(e.get("xmax"), 10)
                ymin, ymax = num(e.get("ymin"), -10), num(e.get("ymax"), 10)
                if xmax <= xmin or (ymax <= ymin and not e.get("yauto")):
                    raise BuildError("A graph has min >= max")
                items.append({"t": "graph", "h": int(e.get("h", 120)), "fns": fns,
                              "xmin": xmin, "xmax": xmax, "ymin": ymin, "ymax": ymax,
                              "grid": bool(e.get("grid", True)), "gx": num(e.get("gx"), 1),
                              "gy": num(e.get("gy"), 1), "samples": int(e.get("samples", 120)),
                              "yauto": bool(e.get("yauto", False))})
            elif t == "input":
                items.append({"t": "in", "label": e.get("label", ""), "var": e.get("var", "").strip(),
                              "value": e.get("value", ""), "unit": e.get("unit", "")})
            elif t == "output":
                items.append({"t": "out", "label": e.get("label", ""), "expr": ti_expr(e.get("expr")),
                              "var": (e.get("var") or "").strip(), "unit": e.get("unit", ""),
                              "digits": int(e["digits"]) if str(e.get("digits", "")).strip() not in ("", "None") else None,
                              "exact": bool(e.get("exact", False))})
            elif t == "divider":
                items.append({"t": "hr"})
            elif t == "spacer":
                items.append({"t": "sp", "h": int(e.get("h", 8))})
        out["tabs"].append({"name": tab.get("name") or "Tab", "items": items})
    return out


def build_lua(doc):
    data = convert(doc)
    src = RUNTIME.read_text()
    return src.replace("--[[DOC]]", "DOC = " + lua_val(data), 1)


def build_tns(doc):
    lua = build_lua(doc)
    with tempfile.TemporaryDirectory() as td:
        lp, tp = Path(td) / "doc.lua", Path(td) / "doc.tns"
        lp.write_text(lua, encoding="utf-8")
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)  # no console flash on Windows
        r = subprocess.run([str(paths.luna_path()), str(lp), str(tp)], capture_output=True,
                           text=True, creationflags=flags)
        if r.returncode != 0 or not tp.exists():
            raise BuildError("Luna failed: " + (r.stdout + r.stderr).strip())
        return tp.read_bytes()
