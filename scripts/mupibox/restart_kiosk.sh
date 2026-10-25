#!/bin/bash
#
# The kiosk (X and Chromium) is started at the box's start by the login on tty1, as root. Started again as another user -
# the web app calls this as dietpi - X cannot take the console ("Cannot open virtual console 1", seen on a Raspberry Pi 5):
# the display stayed dark and the kiosk watchdog's restarts failed the same way. So it always runs as root.
[ "$(id -u)" -eq 0 ] || exec sudo -n "$(readlink -f "$0")" "$@"
sudo killall -r chromium
sleep 2
/var/lib/dietpi/dietpi-software/installed/./chromium-autostart.sh >/dev/null 2>/dev/null &
echo "Chromium-Browser Kiosk restartet"
