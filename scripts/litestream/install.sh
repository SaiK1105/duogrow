#!/usr/bin/env bash
# Downloads the Litestream binary during the Render build. Render's Node runtime
# has no package manager for it, but the build and start steps share a
# filesystem, so fetching it here leaves it available at boot.
set -euo pipefail

VERSION="${LITESTREAM_VERSION:-0.5.16}"
# The release tag carries a leading "v" but the asset filename does not, and the
# archive is named x86_64 rather than amd64 — an "obvious" URL guess 404s.
ARCHIVE="litestream-${VERSION}-linux-x86_64.tar.gz"
URL="https://github.com/benbjohnson/litestream/releases/download/v${VERSION}/${ARCHIVE}"

mkdir -p bin

echo "[litestream] downloading ${URL}"
# -f makes curl exit non-zero on a 404 so a bad version fails the build here,
# rather than at boot where it would look like a database fault.
curl -fsSL "$URL" -o "/tmp/${ARCHIVE}"
tar -xzf "/tmp/${ARCHIVE}" -C bin litestream
chmod +x bin/litestream
rm -f "/tmp/${ARCHIVE}"

echo "[litestream] installed: $(bin/litestream version)"
