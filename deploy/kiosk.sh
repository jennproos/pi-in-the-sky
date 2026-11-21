#!/usr/bin/env bash
# Launch Chromium full-screen on the calendar once the local server is up.
# Started from the desktop session's autostart (see README).
set -u

URL="${CALENDAR_URL:-http://127.0.0.1:3000}"

# Wait up to 2 minutes for the server (it starts in parallel at boot).
for _ in $(seq 1 120); do
  curl -fsS "$URL/api/health" >/dev/null 2>&1 && break
  sleep 1
done

# Raspberry Pi OS ships the browser as `chromium` (Trixie) or `chromium-browser` (Bookworm).
BROWSER="$(command -v chromium || command -v chromium-browser)"
if [ -z "$BROWSER" ]; then
  echo "Chromium not found. Install it with: sudo apt install chromium" >&2
  exit 1
fi

# Clear the "Chromium didn't shut down correctly" bubble after a power cut.
PREFS="$HOME/.config/chromium/Default/Preferences"
if [ -f "$PREFS" ]; then
  sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"[^"]*"/"exit_type":"Normal"/' "$PREFS"
fi

exec "$BROWSER" \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  --disable-session-crashed-bubble \
  --disable-features=Translate \
  --overscroll-history-navigation=0 \
  --disable-pinch \
  --check-for-update-interval=31536000 \
  --password-store=basic \
  "$URL"
