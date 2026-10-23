#!/bin/bash
# Build dist/nspire-studio_<version>_amd64.deb  (needs dpkg-deb)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERSION="${1:-$(cat "$ROOT/VERSION")}"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
"$ROOT/packaging/linux/stage.sh" "$STAGE"
mkdir -p "$STAGE/DEBIAN"
SIZE=$(du -sk "$STAGE" | cut -f1)
cat > "$STAGE/DEBIAN/control" <<C
Package: nspire-studio
Version: $VERSION
Architecture: amd64
Maintainer: ezeren76neptune <150636453+ezeren76neptune@users.noreply.github.com>
Installed-Size: $SIZE
Depends: python3 (>= 3.10), python3-pil, libusb-1.0-0, zlib1g, libstdc++6,
 python3-pyside6.qtcore, python3-pyside6.qtgui, python3-pyside6.qtwidgets,
 python3-pyside6.qtnetwork, python3-pyside6.qtsvg,
 python3-pyside6.qtwebenginecore, python3-pyside6.qtwebenginewidgets
Section: education
Priority: optional
Homepage: https://github.com/ezeren76neptune/nspire-studio
Description: Make notes for TI-Nspire calculators and send them over USB
 Desktop editor for TI-Nspire CX / CX II notes: tabs, text, typeset
 equations, images, graphs and live input/output calculators, previewed on a
 replica of the calculator screen and sent to the calculator over USB.
C
cat > "$STAGE/DEBIAN/postinst" <<'P'
#!/bin/sh
set -e
udevadm control --reload-rules >/dev/null 2>&1 || true
udevadm trigger --subsystem-match=usb --attr-match=idVendor=0451 >/dev/null 2>&1 || true
P
# mime database and desktop entries are refreshed by dpkg triggers
chmod 755 "$STAGE/DEBIAN/postinst"
mkdir -p "$ROOT/dist"
dpkg-deb --root-owner-group --build "$STAGE" "$ROOT/dist/nspire-studio_${VERSION}_amd64.deb" >/dev/null
ls "$ROOT"/dist/*.deb
