# Pi in the Sky

A family wall calendar for a Raspberry Pi and a touchscreen. It merges several ICS calendar feeds into one week or day view, shows the current weather, and is built to be read from across a room.

- **Week view** (default) and **day view**. Tap Week/Day, tap a day's header to open it, or swipe left/right to page through.
- Merges any number of **ICS feeds** (Google, iCloud, Outlook, school sites). Each feed has its own name and color.
- **Weather** from [Open-Meteo](https://open-meteo.com/) (no API key).
- **Refreshes every 5 minutes.** If a feed or the server can't be reached, the last good data stays on screen and a small note in the footer says what failed.
- Returns to the current week after 3 minutes untouched, and reloads itself at 3 am.

The server is a small Fastify app. It downloads and parses the feeds, so the browser never hits CORS limits, and it serves the built React front end.

## Local development

Requires Node 22 or newer (24 LTS recommended, see `.nvmrc`).

```sh
npm install
cp config.example.json config.json   # then edit it (see below)
npm run dev
```

Open http://localhost:5173. `npm run dev` runs the API server on port 3000 (restarting on changes) and the Vite dev server on 5173 (hot reload), with `/api` proxied to the server.

| Script | What it does |
| --- | --- |
| `npm run dev` | API server + Vite dev server with hot reload |
| `npm run build` | Compile the server to `dist/server` and the client to `dist/client` |
| `npm start` | Run the production server (serves the built client on port 3000) |
| `npm test` | Run the Vitest suite once (`npm run test:watch` to keep it running) |
| `npm run typecheck` | Type-check client and server |

Useful while developing: `http://localhost:5173/?view=day&date=2026-11-26` opens a specific day.

### Configuration

`config.json` is gitignored, so your private feed URLs never get committed. To use a different path, set `CONFIG_PATH=/path/to/config.json`.

```jsonc
{
  "port": 3000,
  "location": { "name": "Home", "latitude": 44.98, "longitude": -93.27 },
  "timeZone": "America/Chicago",   // optional; defaults to the system zone
  "units": "fahrenheit",           // or "celsius"
  "weekStartsOn": 0,               // 0 = Sunday, 1 = Monday
  "dayStartHour": 7,               // hours shown in day view
  "dayEndHour": 21,
  "refreshMinutes": 5,
  "feeds": [
    { "name": "Family", "color": "#A0522D", "url": "https://calendar.google.com/calendar/ical/…/basic.ics" },
    { "name": "School", "color": "#66753A", "url": "webcal://…" }
  ]
}
```

The server checks the config at startup and exits with a clear message if something is wrong, such as a bad color or a missing feed.

**Where to find feed URLs**

- **Google Calendar:** Settings → *your calendar* → Integrate calendar → **Secret address in iCal format**.
- **iCloud:** Calendar app → share the calendar → **Public Calendar** → copy link (`webcal://` works).
- **Outlook.com / Microsoft 365:** Settings → Calendar → Shared calendars → **Publish a calendar** → ICS link.

These links work like passwords. Anyone with one can read that calendar, so keep `config.json` private.

**Colors that suit the palette:** rust `#A0522D`, olive `#66753A`, slate teal `#4F6D73`, plum `#7B4B6A`, ochre `#B07D2B`, brick `#8E3B2F`. Pick fairly deep colors: all-day events use the feed color as a background with light text.

**Time zones:** the browser shows events in its own local time zone. On the Pi, the browser and server share the system zone, so set it once (`sudo raspi-config` → Localisation Options → Timezone). `timeZone` in config only controls how the server places floating times and all-day events.

### Project layout

```
src/shared/       types used by both server and client
src/server/       Fastify app, config loading, weather
src/server/ics/   ICS parsing (ical.js), time zones, feed fetching and merging
src/client/       React app: components/, hooks/, lib/ (date and layout helpers), styles/
test/             Vitest tests and .ics fixtures
deploy/           systemd unit, kiosk launcher, autostart entry
```

## Setting up the Raspberry Pi

Tested target: Raspberry Pi 5 (2 GB), 15.6" 1920×1080 touchscreen, **Raspberry Pi OS (64-bit) with desktop**.

### 1. Flash and first boot

1. Flash **Raspberry Pi OS (64-bit)**, the desktop version (not Lite), with [Raspberry Pi Imager](https://www.raspberrypi.com/software/). In the Imager's settings, set your username, Wi-Fi, locale and time zone, and enable SSH.
2. Boot, then update:
   ```sh
   sudo apt update && sudo apt full-upgrade -y
   ```
3. Stop the screen from blanking: `sudo raspi-config` → **Display Options** → **Screen Blanking** → **No**.
4. Check the time zone: `timedatectl`. If it's wrong, fix it with `sudo raspi-config` → Localisation Options → Timezone.

In the commands below, replace `YOUR_USER` with your username on the Pi.

### 2. Install Node.js and the app

```sh
# Node 24 LTS from NodeSource
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs git

cd ~
git clone <your-repo-url> pi-in-the-sky
cd pi-in-the-sky
npm ci
npm run build

cp config.example.json config.json
nano config.json   # add your feeds, location and colors
```

Test it with `npm start`, then open http://127.0.0.1:3000 in Chromium on the Pi. Stop it with Ctrl+C.

The server listens on `127.0.0.1` only. To reach it from another device on your network (handy for checking it from a laptop), add `Environment=HOST=0.0.0.0` to the service file below.

### 3. Run the server on boot (systemd)

```sh
sed "s/YOUR_USER/$USER/g" deploy/pi-in-the-sky.service | sudo tee /etc/systemd/system/pi-in-the-sky.service
sudo systemctl daemon-reload
sudo systemctl enable --now pi-in-the-sky
systemctl status pi-in-the-sky        # should say "active (running)"
journalctl -u pi-in-the-sky -f        # follow the logs
```

systemd restarts the server automatically if it crashes.

### 4. Launch Chromium in kiosk mode on boot

The desktop must log in automatically: `sudo raspi-config` → **System Options** → **Boot / Auto Login** → **Desktop Autologin**.

Then add the kiosk launcher to the desktop session's autostart:

```sh
mkdir -p ~/.config/autostart
sed "s/YOUR_USER/$USER/g" deploy/calendar-kiosk.desktop > ~/.config/autostart/calendar-kiosk.desktop
sudo reboot
```

After the reboot, `deploy/kiosk.sh` waits for the server, then opens Chromium full-screen with no toolbars, no pinch-zoom, no swipe-to-go-back, and no "restore pages?" bubble after a power cut.

To get back to the desktop, plug in a keyboard and press **Alt+F4**. Or SSH in and run `pkill chromium`.

### Updating

```sh
cd ~/pi-in-the-sky
git pull
npm ci
npm run build
sudo systemctl restart pi-in-the-sky
```

The screen picks up the new version at its 3 am reload. To see it straight away, run `pkill chromium` and reboot, or run `deploy/kiosk.sh` from a desktop terminal.

### Troubleshooting

- **"Connecting to the calendar server…" never goes away:** run `systemctl status pi-in-the-sky` and `journalctl -u pi-in-the-sky -n 50`. A config error is printed there.
- **A feed shows "couldn't load":** open the feed URL in a browser. A login page instead of a file that starts with `BEGIN:VCALENDAR` means the link is private or expired.
- **Events are an hour or more off:** the Pi's time zone is wrong (see step 1).
