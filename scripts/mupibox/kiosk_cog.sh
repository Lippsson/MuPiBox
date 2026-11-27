#!/bin/sh
#
# The kiosk client for mupibox.browser = "cog" (see chromium-autostart.sh, kiosk_labwc.sh, docs/cog-wpe-webkit.md): Cog -
# WPE WebKit, a browser without a user interface - run by labwc, the Wayland compositor. The counterpart of kiosk_start.sh,
# which starts Chromium in X.
#
#   labwc -S kiosk_cog.sh [URL]       (kiosk_labwc.sh does that)
#
# 1. the display turned as the app says (Display > Drehung, display_rotation.sh writes it for X: the same file is read here)
# 2. the page's scale from the display's size, as the Chromium kiosk does
# 3. Cog starts once the backend answers: at boot the display can be up before the backend (pm2), and a page asked for too
#    early stays on "can't be reached" (as with Chromium). At most 60 s, then anyway.
#
# Not here yet (done by X tools on the Chromium kiosk, see the doc): the boot screen as the background, mirroring, the
# display's power (DPMS) and the screenshot.

CONFIG="/etc/mupibox/mupiboxconfig.json"
URL="${1:-http://localhost:8200}"

# start background in the base colour of the boot screen (see bootscreen_color.sh), MuPi blue without one; Cog wants
# #RRGGBBAA
BOOT_BG=$(tr -cd '0-9a-f' < /home/dietpi/MuPiBox/sysmedia/images/bootscreen/color 2>/dev/null | cut -c1-6)
[ ${#BOOT_BG} -eq 6 ] || BOOT_BG="44afe2"

# the output (the display on the ribbon cable first), once the compositor answers
OUTPUT=""
i=0
while [ "$i" -lt 40 ]; do
	OUTPUT=$(wlr-randr --json 2>/dev/null | jq -r '([.[] | select(.name | test("DSI"))] + .)[0].name // empty' 2>/dev/null)
	[ -n "${OUTPUT}" ] && break
	sleep 0.25
	i=$((i + 1))
done

# The rotation the app wrote for the X server (Option "Rotate" right|left|inverted). X's "right" turns the picture 90
# degrees clockwise; Wayland's transform 90 is counter-clockwise, so "right" is 270 here.
ROT=$(sed -n 's/^[[:space:]]*Option[[:space:]]*"Rotate"[[:space:]]*"\([a-z]*\)".*/\1/p' /etc/X11/xorg.conf.d/90-mupibox-rotate.conf 2>/dev/null | head -n 1)
case "${ROT}" in
	right) TRANSFORM=270 ;;
	left) TRANSFORM=90 ;;
	inverted) TRANSFORM=180 ;;
	*) TRANSFORM=normal ;;
esac
[ -n "${OUTPUT}" ] && wlr-randr --output "${OUTPUT}" --transform "${TRANSFORM}" >/dev/null 2>&1

# The size the page gets (the current mode, turned): a display larger than the design size 800 x 480 (e.g. 1280 x 720)
# draws the page larger by the smaller of the two factors (1280 x 720: 1.5), as chromium-autostart.sh does with
# --force-device-scale-factor. Cog's --scale is the page's zoom factor, which gives the same layout (853 x 480 CSS pixels).
SIZE=""
[ -n "${OUTPUT}" ] && SIZE=$(wlr-randr --json 2>/dev/null | jq -r --arg o "${OUTPUT}" '.[] | select(.name == $o) | .modes[] | select(.current) | "\(.width) \(.height)"' 2>/dev/null | head -n 1)
RES_X=${SIZE% *}
RES_Y=${SIZE#* }
case "${TRANSFORM}" in
	90 | 270)
		T=${RES_X}
		RES_X=${RES_Y}
		RES_Y=${T}
		;;
esac
[ -n "${SIZE}" ] || {
	RES_X=$(/usr/bin/jq -r '.chromium.resX // 800' ${CONFIG} 2>/dev/null)
	RES_Y=$(/usr/bin/jq -r '.chromium.resY // 480' ${CONFIG} 2>/dev/null)
}
SCALE=$(LC_ALL=C awk -v x="${RES_X}" -v y="${RES_Y}" 'BEGIN { if (x + 0 <= 0 || y + 0 <= 0) { print 1; exit } s = x / 800; if (y / 480 < s) s = y / 480; if (s > 3) s = 3; if (s > 1) printf "%.2f", s; else print 1 }')

i=0
while [ "$i" -lt 240 ] && ! curl -s -o /dev/null --max-time 1 http://localhost:8200/assets/icon/favicon.png; do
	sleep 0.25
	i=$((i + 1))
done

# --webprocess-failure=restart: the page's process is started again when it dies (the watchdog of the Chromium kiosk
# looked at the window's title for that, with xwininfo - there is no X server here)
exec cog --bg-color="#${BOOT_BG}ff" --scale="${SCALE}" --webprocess-failure=restart "${URL}"
