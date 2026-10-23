#!/bin/bash
# Stage an installed tree into $1 (DESTDIR). Run scripts/build-native.sh first.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
D="$1"
L="$D/usr/lib/nspire-studio"
install -d "$L/static/vendor" "$L/static/icons" "$L/native" "$D/usr/bin" \
  "$D/usr/share/applications" "$D/usr/lib/udev/rules.d" "$D/usr/share/doc/nspire-studio"
install -m644 "$ROOT"/{app,server,calc,builder,paths}.py "$ROOT/runtime.lua" "$L/"
install -m644 "$ROOT"/static/*.{html,css,js,svg} "$L/static/"
install -m644 "$ROOT"/static/vendor/* "$L/static/vendor/"
install -m644 "$ROOT"/static/icons/* "$L/static/icons/"
install -m755 "$ROOT/native/luna" "$L/native/luna"
install -m755 "$ROOT/native/libnspire.so" "$L/native/libnspire.so"
cat > "$D/usr/bin/nspire-studio" <<'S'
#!/bin/sh
exec /usr/bin/python3 /usr/lib/nspire-studio/app.py "$@"
S
chmod 755 "$D/usr/bin/nspire-studio"
install -m644 "$ROOT/packaging/linux/nspire-studio.desktop" "$D/usr/share/applications/"
install -m644 "$ROOT/packaging/linux/69-ti-nspire.rules" "$D/usr/lib/udev/rules.d/"
install -Dm644 "$ROOT/packaging/linux/nspire-studio-mime.xml" "$D/usr/share/mime/packages/nspire-studio.xml"
install -m644 "$ROOT/README.md" "$ROOT/LICENSE" "$D/usr/share/doc/nspire-studio/"
for s in 16 22 24 32 48 64 128 256 512; do
  install -Dm644 "$ROOT/static/icons/icon$s.png" "$D/usr/share/icons/hicolor/${s}x${s}/apps/nspire-studio.png"
done
install -Dm644 "$ROOT/static/icon.svg" "$D/usr/share/icons/hicolor/scalable/apps/nspire-studio.svg"
