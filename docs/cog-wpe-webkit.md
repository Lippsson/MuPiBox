# Cog / WPE WebKit instead of Chromium (branch `cog-wpe-webkit`)

Status: **first step, not tested on a box.** The display can be started in Cog; the Chromium kiosk is still the default and
untouched. Switch: `mupibox.browser` in `/etc/mupibox/mupiboxconfig.json` - `"chromium"` (default, also when the key is
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
| `scripts/mupibox/kiosk_cog.sh` (new) | Cog in cage: boot-screen colour as the background, scale from the display size (same formula as the Chromium kiosk), waits for the backend, `--webprocess-failure=restart` |
| `scripts/chromium-autostart.sh` | reads `mupibox.browser`; `"cog"`: no Chromium-window watchdog, starts `cage -d -- kiosk_cog.sh` instead of `startx` |
| `scripts/mupibox/restart_kiosk.sh` | `"cog"`: kills cage and cog (not the Spotify Chromium) and starts the autostart again |
| `scripts/mupibox/spotify_browser.sh` | `wanted` is true when `browser` is `"cog"` |
| `scripts/mupibox/install_cog.sh` (new) | `apt install cog cage` (Debian 13: cog 0.18.4, cage 0.2.0, WPE WebKit 2.48), enables the Spotify service |

## What still talks X11 (not done)

These work only with the Chromium kiosk. With Cog they fail or do nothing; each needs a Wayland counterpart, most of them
want a compositor with the wlroots protocols (output management, screencopy) - cage has neither, **labwc** has both:

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
bash /usr/local/bin/mupibox/install_cog.sh
jq '.mupibox.browser = "cog"' /etc/mupibox/mupiboxconfig.json > /tmp/c.json && cp /tmp/c.json /etc/mupibox/mupiboxconfig.json
reboot
```

Back: `jq '.mupibox.browser = "chromium"' …` and reboot.

To measure: `free -m`, `ps -eo rss,comm | sort -n | tail`, the time until the start page, and whether the themes and the
weather gauges look and move the same.

## Open questions

- Cog's `--scale` (page zoom) against Chromium's device scale factor: same layout? (`kiosk_cog.sh` assumes yes.)
- Does cage on the Pi's KMS drivers (vc4, Waveshare/EDATEC DSI panels) rotate and scale the output correctly? Probably
  not without labwc and `wlr-randr`.
- Is the platform plug-in chosen by Cog on its own under cage (`COG_PLATFORM_NAME` is not set)?
