#!/usr/bin/env bash
# Install a built release on the Pi and switch the running calendar over to it.
#
#   deploy/deploy.sh <release-dir>
#
# <release-dir> must contain dist/, package.json and package-lock.json: either the
# artifact from the GitHub Actions build, or a local checkout after `npm run build`.
#
# Layout under $APP_DIR (default ~/pi-in-the-sky):
#   config.json, data/        yours; never touched here
#   releases/<id>/            one directory per deployed version (last 3 kept)
#   current -> releases/<id>  what systemd runs; swapped atomically
#
# If the new version doesn't come up healthy, `current` is pointed back at the
# previous release and the service restarted, and this script exits non-zero.
set -euo pipefail

SRC="$(cd "${1:?usage: deploy.sh <release-dir>}" && pwd)"
APP_DIR="${APP_DIR:-$HOME/pi-in-the-sky}"
SERVICE="${SERVICE:-pi-in-the-sky}"
KEEP=3

log() { printf '\n==> %s\n' "$*"; }

for f in dist/server/index.js dist/client/index.html package.json package-lock.json; do
  [ -e "$SRC/$f" ] || { echo "Missing $f in $SRC. Run 'npm run build' first." >&2; exit 1; }
done

ID="$(cat "$SRC/REVISION" 2>/dev/null || git -C "$SRC" rev-parse HEAD 2>/dev/null || date +%Y%m%d%H%M%S)"
ID="${ID:0:12}-$(date +%Y%m%d%H%M%S)"
RELEASES="$APP_DIR/releases"
NEW="$RELEASES/$ID"
PREV="$(readlink -f "$APP_DIR/current" 2>/dev/null || true)"

mkdir -p "$RELEASES"

log "Installing release $ID"
mkdir -p "$NEW"
cp -R "$SRC/dist" "$SRC/package.json" "$SRC/package-lock.json" "$NEW/"
[ -d "$SRC/deploy" ] && cp -R "$SRC/deploy" "$NEW/" && chmod +x "$NEW"/deploy/*.sh  # artifacts drop exec bits
[ -f "$SRC/config.example.json" ] && cp "$SRC/config.example.json" "$NEW/"
[ -f "$SRC/REVISION" ] && cp "$SRC/REVISION" "$NEW/"

if [ -n "$PREV" ] && [ -d "$PREV/node_modules" ] && cmp -s "$PREV/package-lock.json" "$NEW/package-lock.json"; then
  log "Dependencies unchanged; reusing them"
  cp -a "$PREV/node_modules" "$NEW/"
else
  log "Installing production dependencies"
  (cd "$NEW" && npm ci --omit=dev --no-audit --no-fund)
fi

if [ ! -f "$APP_DIR/config.json" ]; then
  cp "$NEW/config.example.json" "$APP_DIR/config.json"
  ln -sfn "releases/$ID" "$APP_DIR/current"
  echo "::error::No config.json on the Pi yet. Created $APP_DIR/config.json from the example: edit it, then re-run this deploy." >&2
  exit 1
fi

PORT="$(cd "$APP_DIR" && node -e 'console.log(JSON.parse(require("fs").readFileSync("config.json","utf8")).port ?? 3000)')"
EXPECTED="$(sha256sum "$NEW/dist/client/index.html" | cut -c1-12)"

switch_to() {
  ln -sfn "$1" "$APP_DIR/current.tmp"
  mv -T "$APP_DIR/current.tmp" "$APP_DIR/current"
  sudo -n systemctl restart "$SERVICE"
}

healthy() {
  # Up, and serving the build we just installed (not a stale process).
  for _ in $(seq 1 30); do
    if [ "$(curl -fsS "http://127.0.0.1:$PORT/api/version" 2>/dev/null | sed -n 's/.*"version":"\([^"]*\)".*/\1/p')" = "$1" ]; then
      return 0
    fi
    sleep 1
  done
  return 1
}

log "Switching to $ID and restarting $SERVICE"
switch_to "releases/$ID"

if healthy "$EXPECTED"; then
  log "Deployed $ID; the screen will reload itself within a minute"
else
  echo "::error::New version did not come up healthy. Recent logs:" >&2
  journalctl -u "$SERVICE" -n 30 --no-pager >&2 || true
  if [ -n "$PREV" ] && [ -d "$PREV" ]; then
    log "Rolling back to $(basename "$PREV")"
    switch_to "$PREV"
  fi
  rm -rf "$NEW"
  exit 1
fi

log "Removing old releases (keeping $KEEP)"
CURRENT="$(readlink -f "$APP_DIR/current")"
ls -1dt "$RELEASES"/*/ | sed 's:/$::' | tail -n +$((KEEP + 1)) | while read -r old; do
  [ "$old" = "$CURRENT" ] || rm -rf "$old"
done
