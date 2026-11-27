#!/bin/bash
#
# Installs what the Cog kiosk needs (mupibox.browser = "cog", see docs/cog-wpe-webkit.md): cog (WPE WebKit) and cage (a
# Wayland kiosk compositor). Chromium stays: it is the box's Spotify player (Widevine, which WPE WebKit lacks).
# Runs as root. Does not switch anything on - that is
#
#   jq '.mupibox.browser = "cog"' /etc/mupibox/mupiboxconfig.json   (and a restart of the box)
#
# Back to Chromium: .mupibox.browser = "chromium" (or the key removed).

set -e
[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends cog cage
command -v cog >/dev/null && command -v cage >/dev/null || { echo "cog or cage is missing" >&2; exit 1; }
cog --version
cage -v
# Spotify's player without a screen: on when the kiosk is Cog (spotify_browser.sh looks at mupibox.browser itself)
systemctl enable mupi_spotify_browser.service 2>/dev/null || true
echo "done - set mupibox.browser to cog and restart the box"
