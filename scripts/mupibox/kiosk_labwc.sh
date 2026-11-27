#!/bin/sh
#
# The Wayland compositor of the Cog kiosk (mupibox.browser = "cog", see chromium-autostart.sh and docs/cog-wpe-webkit.md):
# labwc - the compositor of Raspberry Pi OS - runs kiosk_cog.sh and ends with it. Unlike cage it has an output management
# (wlr-randr: turn, scale, switch off the display) and a screen copy (grim), which the box's screenshot and the display's
# power need.
#
# Its configuration is written at every start (the touch screen's name and the output depend on the display):
#   - the Cog window without a frame, full screen
#   - the touch screen mapped to the display's output - the touch is turned with the picture (under X: libinput's
#     calibration matrix, display_rotation.sh)

DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export XDG_RUNTIME_DIR="${DIR}"
mkdir -p "${DIR}" && chmod 700 "${DIR}" 2>/dev/null
CONF="${DIR}/mupibox-labwc"
mkdir -p "${CONF}"

# the display's output as the kernel names it: the one on the ribbon cable (DSI) if there is one, else the first HDMI
OUTPUT=""
for c in /sys/class/drm/card*-DSI-*/status /sys/class/drm/card*-HDMI-*/status; do
	[ -e "${c}" ] || continue
	if [ "$(cat "${c}")" = "connected" ]; then
		OUTPUT=$(basename "$(dirname "${c}")" | sed 's/^card[0-9]*-//')
		break
	fi
done

# the touch screens (input devices with the "direct" property)
TOUCH=""
if [ -n "${OUTPUT}" ]; then
	NAMES=$(awk '
		/^N: Name=/ { name = $0; sub(/^N: Name="/, "", name); sub(/"$/, "", name) }
		/^B: PROP=2$/ { print name }
	' /proc/bus/input/devices)
	OLDIFS=$IFS
	IFS='
'
	for n in ${NAMES}; do
		TOUCH="${TOUCH}	<touch deviceName=\"${n}\" mapToOutput=\"${OUTPUT}\" mouseEmulation=\"no\"/>
"
	done
	IFS=$OLDIFS
fi

cat > "${CONF}/rc.xml" <<EOF
<?xml version="1.0"?>
<!-- Written by kiosk_labwc.sh at every start - changes here are lost. -->
<labwc_config>
	<windowRules>
		<windowRule identifier="*" serverDecoration="no">
			<action name="ToggleFullscreen"/>
		</windowRule>
	</windowRules>
${TOUCH}</labwc_config>
EOF
# (no menu, no keys of its own: nothing but the page)
: > "${CONF}/menu.xml"

# (labwc takes no arguments of its own for the client: the address goes into the command, which it runs with a shell)
exec labwc -C "${CONF}" -S "/usr/local/bin/mupibox/kiosk_cog.sh ${1:-http://localhost:8200}"
