#!/bin/bash
#
# The WiFi's power saving (mupibox.wifiPowerSave in the config: "on" or "off", off when nothing is set), for the interface
# given or for every WiFi interface. Called by udev when a WiFi interface appears (99-mupibox-wifi.rules), and by the
# app when the setting is changed. Needs root.
#
# Off is the default: with power saving on the access point holds back the frames to the box (it counts as asleep), and
# the box is on all the time with music streaming in. Some drivers start with it on (rtw88 of the TP-Link Archer T2U PLUS).

CONFIG="/etc/mupibox/mupiboxconfig.json"
MODE=$(/usr/bin/jq -r '.mupibox.wifiPowerSave // "off"' "${CONFIG}" 2> /dev/null)
[ "${MODE}" = "on" ] || MODE="off"

if [ $# -gt 0 ]; then
	INTERFACES="$*"
else
	INTERFACES=$(/usr/sbin/iw dev 2> /dev/null | awk '$1 == "Interface" {print $2}')
fi

for IFACE in ${INTERFACES}; do
	/usr/sbin/iw dev "${IFACE}" set power_save "${MODE}" 2> /dev/null
done
exit 0
