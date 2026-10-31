#!/bin/bash
#
# The folders of 5.1 below ~/.mupibox (see mupi_paths.sh): server/ (the program), player/, data/ (what the box keeps)
# and cache/. Before, program, data and cache were mixed in Sonos-Kids-Controller-master and spotifycontroller-main -
# and every update had to save the data, replace the program and put the data back, its most delicate step.
#
# Moves a box over, or makes the folders and links a box of 5.1 needs (after a fresh installation; after an update put a
# new server/ in place). It can run as often as it is started: what is in place stays. What an older program wrote at a
# place of before is taken over - when the new place has one too, the newer of the two stays there and the other one is
# kept in data/kept-<time>/ (nothing is deleted). That way a box that went back to a version before 5.1 (its update
# installs it into Sonos-Kids-Controller-master again) comes back whole with the next update.
#
# The names of before stay as links, so an older program, a script or a command typed from the Discord still finds
# everything: Sonos-Kids-Controller-master -> server, spotifycontroller-main -> player; in the program's folder
# server/config -> data/library (with the program's own config.json, monitor.json, network.json and wlan.json linked into
# it), www/cover -> data/covers, www/rss-covers -> cache/rss-covers, cache -> ~/.mupibox/cache; the logs, the app's
# sessions, the hidden covers, the NAS folder index, thumbs/ and the play time of the day at their places of before.
#
# A step that fails takes back all of this run (last first): the box is as it was, and the caller - the update - stops
# before it touches anything. A run cut off (a power cut) leaves .layout-moving behind: the next start finishes it
# (restore_interrupted_update.sh, before pm2 starts the programs), as does the next run.
#
# Runs as root. The app's server and the player are stopped meanwhile and started again after (NO_PM2=1: the caller has
# stopped them - the update), the scripts that write the library waited for and its locks taken (as the backend takes
# them, see restore_interrupted_update.sh). For a test on a copy: MUPI_HOME=<copy>, NO_PM2=1, LOCK_DIR=<dir>,
# LAYOUT_OWNER=<user:group>, FAIL_AT=<step> (fails there, to see the way back).

. "$(dirname "$(readlink -f "$0")")/mupi_paths.sh"

H="${MUPI_HOME}"
SKC="${H}/Sonos-Kids-Controller-master"
SPC="${H}/spotifycontroller-main"
MOVING="${H}/.layout-moving"
OWNER="${LAYOUT_OWNER:-dietpi:dietpi}"
STAMP=$(date +%Y%m%d-%H%M%S)
KEPT="${MUPI_DATA}/kept-${STAMP}"
LOCK_DIR="${LOCK_DIR:-/tmp}"
DATA_LOCK="${LOCK_DIR}/.data.lock"
RESUME_LOCK="${LOCK_DIR}/.resume.lock"
LOCK_TOKEN="layout-${STAMP}"

# what this run did, for the way back: "mv<TAB>from<TAB>to", "ln<TAB>link", "rm<TAB>link<TAB>its target",
# "mkdir<TAB>folder", "rmdir<TAB>folder"
DONE=()
IDENTICAL=()
STOPPED=0
CRON_STOPPED=0
LOCKED=0
STEP=""

log() { echo "migrate_layout: $*"; }

[ -d "${H}" ] || { log "${H} does not exist"; exit 1; }

# ---------------------------------------------------------------------------------------------------- the way back

roll_back() {
	local i entry kind a b
	log "taking back what this run did"
	for ((i = ${#DONE[@]} - 1; i >= 0; i--)); do
		entry="${DONE[$i]}"
		kind="${entry%%$'\t'*}"
		a="${entry#*$'\t'}"
		b="${a#*$'\t'}"
		a="${a%%$'\t'*}"
		case "${kind}" in
			mv) mv -T "${b}" "${a}" || log "could not move ${b} back to ${a}" ;;
			ln) rm -f "${a}" ;;
			rm) ln -s "${b}" "${a}" || log "could not make the link ${a} again" ;;
			mkdir) rmdir "${a}" 2>/dev/null ;;
			rmdir) mkdir -p "${a}" ;;
		esac
	done
	DONE=()
	sync
}

fail() {
	log "FAILED (${STEP}): $*"
	roll_back
	rm -f "${MOVING}"
	finish 1
}

# ------------------------------------------------------------------------------------------ steps that can go back

make_dir() {
	[ -d "$1" ] && return 0
	make_dir "$(dirname "$1")" || return 1
	mkdir "$1" || return 1
	chown "${OWNER}" "$1"
	DONE+=("mkdir"$'\t'"$1")
}

move() {
	make_dir "$(dirname "$2")" || fail "could not make $(dirname "$2")"
	[ "${FAIL_AT:-}" = "${STEP}" ] && fail "test: failing at ${STEP}"
	mv -T "$1" "$2" || fail "could not move $1 to $2"
	DONE+=("mv"$'\t'"$1"$'\t'"$2")
}

# $1 target, $2 the link (made only where nothing is)
link() {
	[ -e "$2" ] || [ -L "$2" ] && return 0
	make_dir "$(dirname "$2")" || fail "could not make $(dirname "$2")"
	ln -s "$1" "$2" || fail "could not make the link $2"
	chown -h "${OWNER}" "$2" 2>/dev/null
	DONE+=("ln"$'\t'"$2")
}

unlink_noted() {
	local target
	target=$(readlink "$1")
	rm -f "$1" || fail "could not remove the link $1"
	DONE+=("rm"$'\t'"$1"$'\t'"${target}")
}

remove_empty_dir() {
	rmdir "$1" 2>/dev/null && DONE+=("rmdir"$'\t'"$1")
}

# $1 from its place of before (a file or folder, not a link), to $2: moved when $2 is not there; folders merged; of two
# files the newer at $2, the other one kept (in data/kept-<time>/, by its path below ~/.mupibox)
place() {
	local src=$1 dst=$2 item kept
	[ -e "${src}" ] && [ ! -L "${src}" ] || return 0
	if [ ! -e "${dst}" ] && [ ! -L "${dst}" ]; then
		move "${src}" "${dst}"
		return
	fi
	if [ -d "${src}" ] && [ -d "${dst}" ] && [ ! -L "${dst}" ]; then
		for item in "${src}"/* "${src}"/.[!.]*; do
			[ -e "${item}" ] || [ -L "${item}" ] || continue
			place "${item}" "${dst}/${item##*/}"
		done
		remove_empty_dir "${src}"
		return
	fi
	kept="${KEPT}/${src#"${H}"/}"
	if [ -f "${src}" ] && [ -f "${dst}" ] && cmp -s "${src}" "${dst}"; then
		move "${src}" "${kept}"
		IDENTICAL+=("${kept}")
	elif [ "${src}" -nt "${dst}" ]; then
		log "${src#"${H}"/} is newer than ${dst#"${H}"/} - taken over, the other one kept"
		move "${dst}" "${KEPT}/${dst#"${H}"/}"
		move "${src}" "${dst}"
	else
		log "${dst#"${H}"/} is newer than ${src#"${H}"/} - stays, the other one kept"
		move "${src}" "${kept}"
	fi
}

# $1 a file of before - its place now $2, a link at the old place
place_linked() {
	place "$1" "$2"
	[ -e "$2" ] && link "$2" "$1"
}

# --------------------------------------------------------------------------------------- quiet, then started again

# a lock the backend's file-lock.ts would take over: gone, its holder no longer runs (or older than 10 min), or an empty
# one of a script older than 30 s
lock_stale() {
	local content age pid
	[ -e "$1" ] || return 0
	content=$(cat "$1" 2>/dev/null)
	age=$(($(date +%s) - $(stat -c %Y "$1" 2>/dev/null || date +%s)))
	pid=$(printf '%s' "${content}" | sed -nE 's/^([0-9]+) [^ ]+$/\1/p')
	if [ -n "${pid}" ]; then
		kill -0 "${pid}" 2>/dev/null || return 0
		[ "${age}" -gt 600 ]
		return
	fi
	[ "${age}" -gt 30 ]
}
take_lock() {
	local i
	for i in $(seq 1 120); do
		if (set -C; printf '%s %s\n' "$$" "${LOCK_TOKEN}" > "$1") 2>/dev/null; then
			chown dietpi:dietpi "$1" 2>/dev/null
			return 0
		fi
		lock_stale "$1" && rm -f "$1"
		sleep 0.5
	done
	return 1
}
own_lock() { [ "$(cat "$1" 2>/dev/null)" = "$$ ${LOCK_TOKEN}" ]; }

quiet() {
	if [ "${NO_PM2:-0}" != 1 ] && pgrep -u dietpi -f 'PM2 v[0-9]' >/dev/null 2>&1 \
		&& sudo -H -u dietpi bash -c 'pm2 jlist 2>/dev/null' | grep -q '"status":"online"'; then
		log "stopping the app's server and the player meanwhile"
		sudo -H -u dietpi bash -c 'pm2 stop server spotify-control >/dev/null 2>&1'
		STOPPED=1
	fi
	if [ "${NO_PM2:-0}" != 1 ] && systemctl is-active --quiet cron 2>/dev/null; then
		systemctl stop cron && CRON_STOPPED=1
	fi
	local i
	for i in $(seq 1 60); do
		pgrep -f 'mupibox/(\./)?(get_network|check_network|m3u_generator|add_index|data_clean)\.sh' >/dev/null 2>&1 || break
		sleep 0.5
	done
	take_lock "${DATA_LOCK}" && take_lock "${RESUME_LOCK}" || { log "the library is locked by another program - try again later"; finish 1; }
	LOCKED=1
}

finish() {
	local l
	if [ "${LOCKED}" = 1 ]; then
		for l in "${DATA_LOCK}" "${RESUME_LOCK}"; do
			own_lock "${l}" && rm -f "${l}"
		done
	fi
	[ "${CRON_STOPPED}" = 1 ] && systemctl start cron
	[ "${STOPPED}" = 1 ] && sudo -H -u dietpi bash -c 'pm2 start server spotify-control >/dev/null 2>&1'
	exit "$1"
}

# ------------------------------------------------------------------------------------------------------- the run

quiet
touch "${MOVING}" && sync

STEP="folders"
for d in "${MUPI_LIBRARY}" "${MUPI_COVERS}" "${MUPI_LOGS}" "${MUPI_CACHE}"; do
	make_dir "${d}" || fail "could not make ${d}"
done

# The programs. A program folder under its name of before is the one that runs (also one an update to a version
# before 5.1 put there): it becomes server/, a server/ there was is kept beside it (server.before-<time>, taken away by
# the next update - a program can always be installed again).
STEP="programs"
for pair in "${SKC}|${MUPI_SERVER}" "${SPC}|${MUPI_PLAYER}"; do
	before="${pair%%|*}"
	now="${pair#*|}"
	if [ -d "${before}" ] && [ ! -L "${before}" ]; then
		[ -e "${now}" ] && move "${now}" "${now}.before-${STAMP}"
		move "${before}" "${now}"
	fi
	[ -d "${now}" ] && link "${now##*/}" "${before}"
done

# The program's config folder of before: the library and what belongs to it into data/library; the program's own
# config.json, monitor.json and wlan.json into server/config (its links to /tmp and to the lists made anew there); the
# home lists and the podcasts' feeds into cache/. Then the folder of before is a link to data/library - and the
# program's own files are linked into it, for an older program that looks for them there.
STEP="library"
CONF_BEFORE="${MUPI_SERVER}/server/config"
if [ -d "${MUPI_SERVER}" ]; then
	make_dir "${MUPI_SERVER_CONFIG}" || fail "could not make ${MUPI_SERVER_CONFIG}"
fi
if [ -d "${CONF_BEFORE}" ] && [ ! -L "${CONF_BEFORE}" ]; then
	for item in "${CONF_BEFORE}"/* "${CONF_BEFORE}"/.[!.]*; do
		[ -e "${item}" ] || [ -L "${item}" ] || continue
		name="${item##*/}"
		case "${name}" in
			config.json | monitor.json | wlan.json)
				if [ -L "${item}" ]; then unlink_noted "${item}"; else place "${item}" "${MUPI_SERVER_CONFIG}/${name}"; fi
				;;
			network.json | active_data.json | active_resume.json)
				# links (to /tmp, to the online or offline lists): made anew below at the new place, to what they pointed at
				if [ -L "${item}" ]; then
					target=$(readlink "${item}")
					unlink_noted "${item}"
					case "${name}" in
						network.json) link "${target}" "${MUPI_SERVER_CONFIG}/${name}" ;;
						*) link "${MUPI_LIBRARY}/${target##*/}" "${MUPI_LIBRARY}/${name}" ;;
					esac
				else
					place "${item}" "${MUPI_LIBRARY}/${name}"
				fi
				;;
			home-lists.json | rss-cache) place "${item}" "${MUPI_CACHE}/${name}" ;;
			*) place "${item}" "${MUPI_LIBRARY}/${name}" ;;
		esac
	done
	remove_empty_dir "${CONF_BEFORE}"
	[ -e "${CONF_BEFORE}" ] && fail "${CONF_BEFORE} is not empty after the move"
fi
if [ -d "${MUPI_SERVER}" ]; then
	link "../../data/library" "${CONF_BEFORE}"
	for name in config.json monitor.json wlan.json; do
		link "../../server/config/${name}" "${MUPI_LIBRARY}/${name}"
	done
	link "/tmp/network.json" "${MUPI_SERVER_CONFIG}/network.json"
	link "../../server/config/network.json" "${MUPI_LIBRARY}/network.json"
fi

# The covers of the local albums, the podcasts' pictures and the cache in the program's folder of before
STEP="covers and cache"
if [ -d "${MUPI_SERVER}" ]; then
	place "${MUPI_SERVER}/www/cover" "${MUPI_COVERS}"
	place "${MUPI_SERVER}/www/rss-covers" "${MUPI_CACHE}/rss-covers"
	place "${MUPI_SERVER}/cache" "${MUPI_CACHE}"
	if [ -d "${MUPI_WWW}" ]; then
		link "../../data/covers" "${MUPI_WWW}/cover"
		link "../../cache/rss-covers" "${MUPI_WWW}/rss-covers"
	fi
	link "../cache" "${MUPI_SERVER}/cache"
fi

# What lay loose in ~/.mupibox, and the player's play time of the day
STEP="loose files"
place_linked "${H}/play_log.jsonl" "${MUPI_LOGS}/play_log.jsonl"
place_linked "${H}/battery_log.jsonl" "${MUPI_LOGS}/battery_log.jsonl"
place_linked "${H}/.app_sessions.json" "${MUPI_DATA}/.app_sessions.json"
place_linked "${H}/hidden-covers.json" "${MUPI_DATA}/hidden-covers.json"
place_linked "${H}/nas-folder-index.json" "${MUPI_DATA}/nas-folder-index.json"
place_linked "${H}/thumbs" "${MUPI_CACHE}/thumbs"
[ -d "${MUPI_PLAYER}/config" ] && place_linked "${MUPI_PLAYER}/config/playtime-checkpoint.json" "${MUPI_DATA}/playtime-checkpoint.json"

STEP="owner"
# (the program's config.json and monitor.json keep their owner: root, as the update writes them)
chown -R "${OWNER}" "${MUPI_DATA}" "${MUPI_CACHE}" || fail "could not hand data/ and cache/ to ${OWNER}"
sync

# Done: copies that were the same as the file now in place are not needed
for f in "${IDENTICAL[@]}"; do
	rm -f "${f}"
done
[ -d "${KEPT}" ] && find "${KEPT}" -depth -type d -empty -delete 2>/dev/null
[ -d "${KEPT}" ] && log "kept: ${KEPT}"
rm -f "${MOVING}"
sync
log "done"
finish 0
