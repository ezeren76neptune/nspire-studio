#!/bin/bash
# Lets your user talk to TI-Nspire calculators over USB without root.
# Run with: sudo ./install-udev.sh
set -e
RULE=/etc/udev/rules.d/69-ti-nspire.rules
cat > "$RULE" <<'R'
# TI-Nspire CX / CX CAS and CX II / CX II CAS (Nspire Studio)
SUBSYSTEM=="usb", ATTRS{idVendor}=="0451", ATTRS{idProduct}=="e012", MODE="0660", TAG+="uaccess"
SUBSYSTEM=="usb", ATTRS{idVendor}=="0451", ATTRS{idProduct}=="e022", MODE="0660", TAG+="uaccess"
R
udevadm control --reload-rules
udevadm trigger --subsystem-match=usb --attr-match=idVendor=0451 || true
echo "Installed $RULE"
cat "$RULE"
