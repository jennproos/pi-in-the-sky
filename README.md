# Pi in the Sky

A family wall calendar for a Raspberry Pi and a touchscreen. It merges several ICS calendar feeds into one week or day view, shows the current weather, and is built to be read from across a room.

- **Week view** (default) and **day view**. Tap Week/Day, tap a day's header to open it, or swipe left/right to page through.
- Merges any number of **ICS feeds** (Google, iCloud, Outlook, school sites). Each feed has its own name and color.
- **Weather** from [Open-Meteo](https://open-meteo.com/) (no API key).
- **Refreshes every 5 minutes.** If a feed or the server can't be reached, the last good data stays on screen and a small note in the footer says what failed.
- **To-do list** beside the calendar. Add and edit items on the wall with a built-in keyboard, assign them to one person or several, and tick them off with a tap. Finished items clear at midnight.
- Returns to the current week after 3 minutes untouched, and reloads itself at 3 am.
- **Automatic deploys:** pushing to `main` tests the code, deploys it to the Pi, and reloads the screen. A broken build never reaches the wall.

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
  "people": [                      // who to-do items can be assigned to (optional)
    { "name": "Your name", "color": "#7B4B6A" },
    { "name": "Cole", "color": "#4F6D73" }
  ],
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

### 2. Install Node.js

```sh
# Node 24 LTS from NodeSource
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # v24.x
```

In the commands below, `$USER` fills in your username automatically.

### 3. Create the calendar service (systemd)

The app lives in `~/pi-in-the-sky`:

```
~/pi-in-the-sky/
  config.json             your settings and feed links (never touched by deploys)
  data/                   the to-do list (never touched by deploys)
  current -> releases/…   the version that's running
  releases/               the last 3 deployed versions
```

Create the service, and allow the deploy to restart it without a password. The deploy may restart this one service and nothing else.

```sh
mkdir -p ~/pi-in-the-sky

sudo tee /etc/systemd/system/pi-in-the-sky.service >/dev/null <<UNIT
[Unit]
Description=Pi in the Sky family calendar server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/home/$USER/pi-in-the-sky
Environment=NODE_ENV=production
ExecStart=/usr/bin/node current/dist/server/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

echo "$USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart pi-in-the-sky" | sudo tee /etc/sudoers.d/pi-in-the-sky >/dev/null
sudo chmod 440 /etc/sudoers.d/pi-in-the-sky
sudo visudo -c   # should say "parsed OK"

sudo systemctl daemon-reload
sudo systemctl enable pi-in-the-sky
```

The same files are in the repo as `deploy/pi-in-the-sky.service` and `deploy/sudoers`. The service starts once the first version is deployed in the next step. systemd restarts it automatically if it crashes.

### 4. Set up automatic deploys

Every push to `main` runs the tests and builds the app on GitHub's servers (`.github/workflows/ci.yml`). If that passes, a **GitHub Actions runner on the Pi** downloads the build and switches the calendar over to it. If the new version doesn't start properly, the deploy rolls back to the previous one and the job fails, so you'll see it in the repo's **Actions** tab. The screen reloads itself onto the new version within a minute.

The runner connects *out* to GitHub, so you don't need to open any ports on your router. Keep the repository **private**: a self-hosted runner on a public repo could be made to run other people's code on the Pi. The deploy job only runs for pushes to `main`, never for pull requests.

1. **Install the runner.** On GitHub, open the repo's **Settings → Actions → Runners → New self-hosted runner**, choose **Linux** and **ARM64**, and run the *Download* and *Configure* commands it shows on the Pi. When `config.sh` asks:
   - runner group, name, work folder: press Enter to accept the defaults
   - **labels: type `pi-calendar`** (the workflow looks for this label)
2. **Run the runner as a service**, so it starts on boot. From the runner's folder:
   ```sh
   sudo ./svc.sh install $USER
   sudo ./svc.sh start
   ```
   It should now show as **Idle** on the Runners page.
3. **Turn deploys on.** Until you do this, pushes only run the tests. On your laptop:
   ```sh
   gh variable set DEPLOY_ENABLED --body true
   ```
   Or set it in the browser: **Settings → Secrets and variables → Actions → Variables**.
4. **First deploy.** Open **Actions → CI and deploy → Run workflow** on `main`. The first run installs the app, creates `~/pi-in-the-sky/config.json` from the example, then **stops on purpose** so you can fill it in:
   ```sh
   nano ~/pi-in-the-sky/config.json   # feeds, location, people, colors
   ```
   Then click **Re-run all jobs** on that run. It should go green, and http://127.0.0.1:3000 shows the calendar.

From now on, `git push` to `main` is all it takes to update the wall.

**Deploying without GitHub:** on any machine with this repo, run `npm ci && npm run build`. Copy the folder to the Pi, for example with `rsync -a --exclude node_modules ./ pi:pi-in-the-sky-src/`. Then on the Pi run `bash ~/pi-in-the-sky-src/deploy/deploy.sh ~/pi-in-the-sky-src`.

### 5. Launch Chromium in kiosk mode on boot

The desktop must log in automatically: `sudo raspi-config` → **System Options** → **Boot / Auto Login** → **Desktop Autologin**.

Then add the kiosk launcher to the desktop session's autostart:

```sh
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/calendar-kiosk.desktop <<DESKTOP
[Desktop Entry]
Type=Application
Name=Family calendar kiosk
Exec=/home/$USER/pi-in-the-sky/current/deploy/kiosk.sh
X-GNOME-Autostart-enabled=true
DESKTOP
sudo reboot
```

After the reboot, `kiosk.sh` waits for the server, then opens Chromium full-screen with no toolbars, no pinch-zoom, no swipe-to-go-back, and no "restore pages?" bubble after a power cut.

To get back to the desktop, plug in a keyboard and press **Alt+F4**. Or SSH in and run `pkill chromium`.

The server listens on `127.0.0.1` only. To reach it from another device on your network, add `Environment=HOST=0.0.0.0` under `[Service]` in `/etc/systemd/system/pi-in-the-sky.service`, then run `sudo systemctl daemon-reload && sudo systemctl restart pi-in-the-sky`.

### Troubleshooting

- **"Connecting to the calendar server…" never goes away:** run `systemctl status pi-in-the-sky` and `journalctl -u pi-in-the-sky -n 50`. A config error is printed there.
- **A feed shows "couldn't load":** open the feed URL in a browser. A login page instead of a file that starts with `BEGIN:VCALENDAR` means the link is private or expired.
- **Events are an hour or more off:** the Pi's time zone is wrong (see step 1).
- **A deploy failed:** open the failed run in the repo's **Actions** tab. The deploy step prints the server's last log lines, and the wall stays on the previous version. A job stuck on *Waiting for a runner* means the Pi is off or its runner service isn't running: check with `sudo ./svc.sh status` in the runner folder.
- **Roll back by hand:** run `ls ~/pi-in-the-sky/releases`, then `ln -sfn releases/<older> ~/pi-in-the-sky/current && sudo systemctl restart pi-in-the-sky`.
