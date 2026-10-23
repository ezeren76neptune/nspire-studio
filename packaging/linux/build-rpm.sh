#!/bin/bash
# Build dist/nspire-studio-<version>.x86_64.rpm  (needs rpmbuild)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERSION="${1:-$(cat "$ROOT/VERSION")}"
STAGE="$(mktemp -d)"; TOP="$(mktemp -d)"
trap 'rm -rf "$STAGE" "$TOP"' EXIT
"$ROOT/packaging/linux/stage.sh" "$STAGE"
rpmbuild -bb --define "_topdir $TOP" --define "version $VERSION" --define "stage $STAGE" \
  --quiet "$ROOT/packaging/linux/nspire-studio.spec" >/dev/null 2>&1
mkdir -p "$ROOT/dist"
cp "$TOP"/RPMS/*/*.rpm "$ROOT/dist/"
ls "$ROOT"/dist/*.rpm
