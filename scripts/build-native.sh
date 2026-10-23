#!/bin/bash
# Build libnspire (USB) and Luna (.tns packer) into ./native.
# Linux: needs gcc, g++, make, autoconf, automake, libtool, pkg-config, libusb-1.0 and zlib headers.
# Windows: run inside an MSYS2 MINGW64 shell (see .github/workflows/release.yml).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/native"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$OUT"
git -C "$ROOT" submodule update --init --recursive 2>/dev/null || true

case "$(uname -s)" in MINGW*|MSYS*) WIN=1 ;; *) WIN=0 ;; esac

# --- libnspire ---------------------------------------------------------------
cp -r "$ROOT/vendor/libnspire" "$WORK/libnspire"
cd "$WORK/libnspire"
if [ "$WIN" = 1 ]; then
  # ntohs/htons come from winsock on Windows
  sed -i 's|#include <arpa/inet.h>|#ifdef _WIN32\n#include <winsock2.h>\n#else\n#include <arpa/inet.h>\n#endif|' src/cx2.cpp
fi
autoreconf -fi >/dev/null 2>&1
if [ "$WIN" = 1 ]; then
  ./configure --prefix="$WORK/inst" --disable-static LIBS="-lws2_32" >/dev/null
  make -j"$(nproc)" LDFLAGS="-no-undefined -static-libgcc -static-libstdc++" >/dev/null
else
  ./configure --prefix="$WORK/inst" --disable-static >/dev/null
  make -j"$(nproc)" >/dev/null
fi
make install >/dev/null
if [ "$WIN" = 1 ]; then
  cp "$WORK"/inst/bin/libnspire*.dll "$OUT/"
else
  cp -L "$WORK/inst/lib/libnspire.so" "$OUT/libnspire.so"
fi

# --- Luna --------------------------------------------------------------------
cp -r "$ROOT/vendor/luna" "$WORK/luna"
cd "$WORK/luna"
if [ "$WIN" = 1 ]; then
  make -j"$(nproc)" LDFLAGS="-flto -static -lz" >/dev/null
  cp luna.exe "$OUT/"
else
  make -j"$(nproc)" >/dev/null
  cp luna "$OUT/"
fi

# --- Windows runtime DLLs (libusb, libgcc, libstdc++, winpthread...) ----------
if [ "$WIN" = 1 ]; then
  for f in "$OUT"/*.dll "$OUT"/luna.exe; do
    ldd "$f" | awk '/mingw64/ {print $3}' | while read -r dll; do cp -n "$dll" "$OUT/"; done
  done
fi
echo "Built into $OUT:"; ls -la "$OUT"
