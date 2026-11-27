#!/bin/sh
#
# The kiosk client for mupibox.browser = "cog" (see chromium-autostart.sh, docs/cog-wpe-webkit.md): Cog - WPE WebKit, a
# browser without a user interface - run by cage, a Wayland compositor that shows one maximised application. The
# counterpart of kiosk_start.sh, which starts Chromium in X.
#
#   cage -d -- kiosk_cog.sh [URL]
#
# Cog starts once the backend answers: at boot the display can be up before the backend (pm2), and a page asked for too
# early stays on "can't be reached" (as with Chromium). At most 60 s, then anyway.
#
# Not here yet (done by X tools on the Chromium kiosk, see the doc): the boot screen as the background, the screen's own
# size for a KMS display on the ribbon cable, mirroring, the display's power (DPMS) and the screenshot.

CONFIG="/etc/mupibox/mupiboxconfig.json"
URL="${1:-http://localhost:8200}"

# start background in the base colour of the boot screen (see bootscreen_color.sh), MuPi blue without one; Cog wants
# #RRGGBBAA
BOOT_BG=$(tr -cd '0-9a-f' < /home/dietpi/MuPiBox/sysmedia/images/bootscreen/color 2>/dev/null | cut -c1-6)
[ ${#BOOT_BG} -eq 6 ] || BOOT_BG="44afe2"

# A display larger than the design size 800 x 480 (e.g. 1280 x 720): the page is drawn larger by the smaller of the two
# factors (1280 x 720: 1.5), as chromium-autostart.sh does with --force-device-scale-factor. Cog's --scale is the
# page's zoom factor, which gives the same layout (the page is 853 x 480 CSS pixels then).
RES_X=$(/usr/bin/jq -r '.chromium.resX // 800' ${CONFIG} 2>/dev/null)
RES_Y=$(/usr/bin/jq -r '.chromium.resY // 480' ${CONFIG} 2>/dev/null)
SCALE=$(LC_ALL=C awk -v x="${RES_X}" -v y="${RES_Y}" 'BEGIN { if (x + 0 <= 0 || y + 0 <= 0) { print 1; exit } s = x / 800; if (y / 480 < s) s = y / 480; if (s > 3) s = 3; if (s > 1) printf "%.2f", s; else print 1 }')

i=0
while [ "$i" -lt 240 ] && ! curl -s -o /dev/null --max-time 1 http://localhost:8200/assets/icon/favicon.png; do
	sleep 0.25
	i=$((i + 1))
done

# --webprocess-failure=restart: the page's process is started again when it dies (the watchdog of the Chromium kiosk
# looked at the window's title for that, with xwininfo - there is no X server here)
exec cog --bg-color="#${BOOT_BG}ff" --scale="${SCALE}" --webprocess-failure=restart "${URL}"
