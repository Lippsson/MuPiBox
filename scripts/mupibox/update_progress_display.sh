#!/bin/bash
#
# The progress of an update on the display: $1 = percent, $2 = the step as the update script names it (its whiptail
# lines, English). Called by the app's update for every step (backend-api app-api/updates.ts: the stand-in for whiptail
# and run.sh) - in the background, it never holds the update up. The step becomes one of a few parts with a sentence in
# the box's language (prepare, download, packages, install, settings, done, failed); the maintenance picture is drawn
# with the bar (maintenance_screen.sh update <percent> <part>) at most every 2 seconds - the first, the end and an
# abort at once. One at a time: a call while one draws is left out (the next one brings the newer state).

PCT="$1"
STEP="$2"
STATE=/tmp/mupibox-update-progress.state
LOCK=/tmp/mupibox-update-progress.lock

case "${PCT}" in '' | *[!0-9]*) exit 0 ;; esac
# (the display still shows the box - before the update ends it, or an update of the system that leaves it on: fbv
# would draw over it)
if pgrep -x chromium >/dev/null || pgrep -x chromium-browse >/dev/null; then
	exit 0
fi

case "${STEP}" in
	"Update aborted"*) PART=failed ;;
	"Installation complete"*) PART=done ;;
	"Start" | "Prepare"* | "Backup" | "Download") PART=prepare ;;
	"Restarting"* | "Set environment"* | "Download OnOffShim"* | "Update Config"* | "Network"* | "Activate SSL"* | "Finalizing"* | "Remove the previous admin"*) PART=settings ;;
	"Download MuPiBox"* | "Unzip"*) PART=download ;;
	"Update package-list"* | "Update Node.js"* | "Update Chromium"* | "Install package"* | "Remove "* | "Setup DietPi"*) PART=packages ;;
	"Install LED"*) PART=install ;;
	"Install "*) PART=packages ;;
	*) PART=install ;;
esac
# (100 % is the end only with the end's step - an abort says 100 too)
[ "${PART}" = "done" ] || [ "${PART}" = "failed" ] || [ "${PCT}" -lt 100 ] || PCT=99

NOW=$(date +%s)
LAST_PCT= LAST_PART= LAST_AT=
[ -f "${STATE}" ] && read -r LAST_PCT LAST_PART LAST_AT < "${STATE}"
[ "${PCT}" = "${LAST_PCT}" ] && [ "${PART}" = "${LAST_PART}" ] && exit 0
case "${PART}" in
	done | failed) ;;
	*) [ -n "${LAST_AT}" ] && [ $((NOW - LAST_AT)) -lt 2 ] && [ "${PART}" = "${LAST_PART}" ] && exit 0 ;;
esac

exec 9>"${LOCK}"
if [ "${PART}" = "done" ] || [ "${PART}" = "failed" ]; then
	# (the end waits for a picture being drawn: it is the one that stays)
	flock -w 10 9 || exit 0
else
	flock -n 9 || exit 0
fi
echo "${PCT} ${PART} ${NOW}" > "${STATE}"
[ -x /usr/local/bin/mupibox/maintenance_screen.sh ] && /usr/local/bin/mupibox/maintenance_screen.sh update "${PCT}" "${PART}"
exit 0
