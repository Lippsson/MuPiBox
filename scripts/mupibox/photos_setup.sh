#!/bin/bash
#
# The photo display (5.1): the programs it needs, installed only when it is switched on in the app (a box that never
# shows photos gets nothing of it). Run as root by the app's server (backend-api app-api/photos/routes.ts) and by the
# update for a box that has it on.
#
#   photos_setup.sh heif     heif-convert (libheif-examples): iPhone photos (HEIC) to JPEG - when the display is on
#   photos_setup.sh video    ffmpeg: video clips into a format the Pi plays - when "Videos anzeigen" is on
#   photos_setup.sh status   what is there

APT="flock -w 120 /tmp/.mupibox.apt.lock"

set -u

# one at a time (the app's switches, the update)
exec 9>/run/lock/mupibox-photos-setup.lock
flock -w 900 9 || { echo "another photo setup is still running"; exit 1; }

need() {
	# $1 program, $2 package
	command -v "$1" >/dev/null 2>&1 && return 0
	DEBIAN_FRONTEND=noninteractive ${APT} apt-get -o DPkg::Lock::Timeout=600 install -y -q --no-install-recommends "$2" || {
		# (the package list may be old - an image of months before: read it once more and try again)
		${APT} apt-get -o DPkg::Lock::Timeout=600 update -q >/dev/null 2>&1
		DEBIAN_FRONTEND=noninteractive ${APT} apt-get -o DPkg::Lock::Timeout=600 install -y -q --no-install-recommends "$2" || return 1
	}
	command -v "$1" >/dev/null 2>&1
}

case "${1:-}" in
heif)
	need heif-convert libheif-examples || exit 1
	;;
video)
	need ffmpeg ffmpeg || exit 1
	;;
status)
	command -v heif-convert >/dev/null 2>&1 && echo "heif: yes" || echo "heif: no"
	command -v ffmpeg >/dev/null 2>&1 && echo "video: yes" || echo "video: no"
	;;
*)
	echo "usage: $0 heif|video|status"
	exit 2
	;;
esac
