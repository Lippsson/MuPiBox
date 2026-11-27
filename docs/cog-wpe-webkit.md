# Cog / WPE WebKit instead of Chromium (branch `cog-wpe-webkit`)

Status: **runs on the Pi 5 (Waveshare 8.8" DSI, 480 x 1920): the page shows, rotation and touch are right.** Spotify, screenshot and
display power do not work yet. The Chromium kiosk is still the default and untouched. Switch: `mupibox.browser` in `/etc/mupibox/mupiboxconfig.json` - `"chromium"` (default, also when the key is
missing) or `"cog"`.

## Why, and what it costs

Cog is a browser without a user interface, built on WPE WebKit for kiosks and embedded devices. Expected gain on a Pi:
a few hundred MB less memory, no X server, a faster start. Cost: everything around the display was written for Chromium
in X (below), and **Spotify cannot move**.

## Spotify stays in Chromium

The display's page is the box's Spotify player: `src/frontend-box/src/app/spotify-player.service.ts` loads the Web
Playback SDK (`sdk.scdn.co/spotify-player.js`), which needs Widevine DRM (`libwidevinecdm0`, see `autosetup.sh`). WPE WebKit
on Debian has no Widevine. So with `"browser": "cog"`:

- the **display** is Cog (cage + cog, `kiosk_cog.sh`);
- the **Spotify device** is a Chromium without a screen: `mupi_spotify_browser.service` / `spotify_browser.sh`, which
  already exists for boxes without a DSI display. `spotify_browser.sh` now runs whenever `browser` is `"cog"`.
  `install_cog.sh` enables the service.

Memory: this Chromium needs about as much as the kiosk without X, so the gain is mostly the X server and the second
page, not Chromium as a whole. Measure it before going on.

## What is done

| File | Change |
|---|---|
| `scripts/mupibox/kiosk_labwc.sh` (new) | the compositor: writes labwc's config at every start (Cog window without frame, full screen; touch screen mapped to the output, calibration matrix "none"), then `labwc -S kiosk_cog.sh` |
| `scripts/mupibox/kiosk_cog.sh` (new) | the client labwc runs: turns the output as the app's rotation says (`wlr-randr`), scale from the turned display size (same formula as the Chromium kiosk), boot-screen colour, waits for the backend, Cog with `--webprocess-failure=restart` |
| `scripts/chromium-autostart.sh` | reads `mupibox.browser`; `"cog"`: no Chromium-window watchdog, starts `kiosk_labwc.sh` instead of `startx` |
| `scripts/mupibox/restart_kiosk.sh` | `"cog"`: kills labwc, cog and Xorg (not the Spotify Chromium) and starts the autostart again |
| `scripts/mupibox/spotify_browser.sh` | `wanted` is true when `browser` is `"cog"` |
| `scripts/mupibox/install_cog.sh` (new) | `apt install cog cage` (Debian 13: cog 0.18.4, WPE WebKit 2.48). labwc, wlr-randr and grim are needed too (see below), enables the Spotify service |

## What the Pi 5 test showed

- **cage is not enough.** It has no output management, so no rotation. The compositor is **labwc** (Raspberry Pi OS's own)
  with `wlr-randr` (rotate, scale, power) and `grim` (screenshot): `apt install labwc wlr-randr grim`.
- **Rotation:** the app's setting for X (`Option "Rotate" "right"` in `/etc/X11/xorg.conf.d/90-mupibox-rotate.conf`) is read;
  X's "right" is 90 degrees clockwise = Wayland transform **270** (Wayland's 90 is counter-clockwise).
- **Touch: no matrix.** `display_rotation.sh` gives the touch screen a calibration matrix by a udev rule
  (`LIBINPUT_CALIBRATION_MATRIX`), which libinput hands to every program - labwc included. labwc turns the touch with the
  output's rotation itself: both together turned it twice. Setting the matrix to `1 0 0 0 1 0` for the touch screens in
  labwc's config fixes it. (Raw values of the panel, native 480 x 1920: top left of the turned picture = x 411, y 58.)
- **Memory:** cage/labwc + Cog + WPE processes about 430 MB in total (RSS), against about 1.4 GB for Chromium's processes
  (sums, shared memory counted twice) - without the Spotify Chromium that has to be added.

## What still talks X11 (not done)

These work only with the Chromium kiosk. With Cog they fail or do nothing; each needs a Wayland counterpart, most of them
want a compositor with the wlroots protocols (output management, screencopy) - labwc has both (installed above):

| Function | Today (X) | Wayland |
|---|---|---|
| Screenshot (app, Telegram, MQTT) | `screenshot.sh` with `scrot` | `grim` (needs screencopy) |
| Display off / on (DPMS) | `xset` in `get_monitor.sh` and others | `wlr-randr --off/--on` |
| Rotation, mirroring, size of a KMS panel | `xrandr`, `display_rotation.sh`, `/etc/X11/mupibox-reflect` | `wlr-randr --transform`, `--scale` |
| "The display shows the start page" | `wait_display_ready.sh` (`xwininfo` title) | e.g. the page reports itself to the backend once |
| Boot screen as the background until the page is there | `feh`, `xsetroot` in `kiosk_start.sh` | Cog's `--bg-color` (done, one colour only) |
| Kiosk watchdog | `xwininfo` title in `chromium-autostart.sh` | `--webprocess-failure=restart` (done) |
| Touch calibration, cursor | X server options | libinput / compositor |
| Goodbye picture, update picture | `show_goodbye.sh`, `update_progress_display.sh` | to check |
| Extensions (`oled` API) | mention X tools | to check |

## Frontend to check

- The Spotify service in the display page: with Cog its SDK cannot start (no EME/Widevine). The page must not show an
  error, and the display's Spotify state (now playing) has to come from the Spotify page's device instead of its own SDK.
  Not looked at yet.
- Everything the pages use that WebKit does differently: the SteelSeries canvas gauges of the weather extension, the
  Cover Flow and Winamp themes (`-webkit-box-reflect` is native WebKit), touch gestures (Chromium has
  `--disable-pinch`, `--disable-features=OverscrollHistoryNavigation`), the extension overlays.

## Trying it (test box, not a box that someone uses)

```sh
# as root on the box
bash /usr/local/bin/mupibox/install_cog.sh   # cog, cage, labwc, wlr-randr, grim
jq '.mupibox.browser = "cog"' /etc/mupibox/mupiboxconfig.json > /tmp/c.json && cp /tmp/c.json /etc/mupibox/mupiboxconfig.json
reboot
```

Back: `jq '.mupibox.browser = "chromium"' …` and reboot.

To measure: `free -m`, `ps -eo rss,comm | sort -n | tail`, the time until the start page, and whether the themes and the
weather gauges look and move the same.

## Open questions

- Cog's `--scale` (page zoom) against Chromium's device scale factor: same layout? (`kiosk_cog.sh` assumes yes.)
- Other displays (the Touch Display 2, EDATEC, HDMI): rotation and touch need the same check as the Waveshare 8.8".
- Is the platform plug-in chosen by Cog on its own under cage (`COG_PLATFORM_NAME` is not set)?
