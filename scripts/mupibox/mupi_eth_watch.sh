#!/bin/bash
#
# Watches eth0's carrier (link) state and re-runs mupi_wifi_select.sh the moment it changes, so LAN/WiFi
# failover reacts immediately to the cable being plugged or unplugged.
#
# The usual mechanism for this (a udev rule reacting to ATTR{carrier}, see 99-mupibox-wifi.rules for the
# same pattern applied to WiFi adapters) does not work on this board: its onboard ethernet driver never
# emits a uevent for a carrier change (confirmed live: "udevadm monitor" stayed silent through several
# unplug/replug cycles), even though the sysfs "carrier" file itself is correct when read. "ip monitor
# link" uses the kernel's rtnetlink notifications instead, a different and, on this hardware, reliable
# mechanism - confirmed live: it reported both NO-CARRIER and LOWER_UP immediately on every cable pull.

ip monitor link dev eth0 2>/dev/null | while read -r line; do
	case "$line" in
	*NO-CARRIER* | *LOWER_UP*)
		/usr/local/bin/mupibox/mupi_wifi_select.sh
		;;
	esac
done
