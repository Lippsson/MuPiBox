#!/bin/bash
#
# Settings of the admin interface that do not live in mupiboxconfig.json but in the system itself
# (boot files, driver options, services, ...). They are written into a small JSON file for the
# configuration backup and put back on a restore.
#
#   system_settings.sh export <file>   writes the current values into <file>
#   system_settings.sh apply <file>    puts the values from <file> back (run as root; a reboot follows)
#
# Only values that the admin interface can change are handled. A value that is missing in the file
# is left as it is, so a backup made by an older version restores without touching those settings.

# (the paths can be set from outside for a test)
BOOT_CONFIG="${BOOT_CONFIG:-/boot/config.txt}"
DIETPI_TXT="${DIETPI_TXT:-/boot/dietpi.txt}"
DHCP_CONF="${DHCP_CONF:-/etc/dhcp/dhclient.conf}"
MUPIBOX_CONFIG="${MUPIBOX_CONFIG:-/etc/mupibox/mupiboxconfig.json}"
SPOTIFY_CONFIG="${SPOTIFY_CONFIG:-/home/dietpi/.mupibox/spotifycontroller-main/config/config.json}"
MODPROBE_DIR="${MODPROBE_DIR:-/etc/modprobe.d}"
USB_WIFI_MODULES="88x2bu 8821au"
# Services the admin interface switches on and off. Only started units that exist are handled.
SERVICES="mupi_fan mupi_rotary mupi_mqtt mupi_telegram mupi_autoconnect_bt mupi_vnc mupi_novnc mupi_autoconnect-wifi dietpi-wifi-monitor smbd proftpd"

if [ "$EUID" -ne 0 ]; then
	echo "Please run as root"
	exit 1
fi

read_boot_value() { # <name>: value of "name=value" in config.txt (empty if not set)
	sed -n "/^[[:blank:]]*$1=/{s/^[^=]*=//p;q}" "${BOOT_CONFIG}" 2>/dev/null
}

unit_exists() {
	systemctl list-unit-files "$1.service" 2>/dev/null | grep -q "^$1.service"
}

usb_power_value() { # <module>: rtw_power_mgnt of /etc/modprobe.d/<module>.conf (empty if not set)
	sed -n -E "s/^options[[:space:]]+$1\b.*\brtw_power_mgnt=([0-9]).*/\1/p" "${MODPROBE_DIR}/$1.conf" 2>/dev/null | head -n 1
}

export_settings() {
	local out="$1" tmp
	tmp=$(mktemp) || exit 1

	local usb='{}' module value
	for module in ${USB_WIFI_MODULES}; do
		value=$(usb_power_value "${module}")
		[ -n "${value}" ] && usb=$(jq -c --arg m "${module}" --arg v "${value}" '.[$m] = $v' <<< "${usb}")
	done

	local services='{}' unit
	for unit in ${SERVICES}; do
		if unit_exists "${unit}"; then
			if systemctl is-enabled --quiet "${unit}.service" 2>/dev/null; then
				services=$(jq -c --arg u "${unit}" '.[$u] = true' <<< "${services}")
			else
				services=$(jq -c --arg u "${unit}" '.[$u] = false' <<< "${services}")
			fi
		fi
	done

	local governor
	governor=$(sed -n 's/^CONFIG_CPU_GOVERNOR=//p' "${DIETPI_TXT}" 2>/dev/null | head -n 1)
	local log_level
	log_level=$(jq -r '.logLevel // empty' "${SPOTIFY_CONFIG}" 2>/dev/null)
	local sound_card
	sound_card=$(jq -r '.mupibox.physicalDevice // empty' "${MUPIBOX_CONFIG}" 2>/dev/null)

	jq -n \
		--arg hdmi "$(read_boot_value display_hdmi_rotate)" \
		--arg lcd "$(read_boot_value lcd_rotate)" \
		--arg dlcd "$(read_boot_value display_lcd_rotate)" \
		--arg turbo "$(read_boot_value initial_turbo)" \
		--argjson avoid "$(grep -q '^avoid_warnings=1' "${BOOT_CONFIG}" 2>/dev/null && echo true || echo false)" \
		--argjson sdtweak "$(grep -q 'dtoverlay=sdtweak,overclock_50=100' "${BOOT_CONFIG}" 2>/dev/null && echo true || echo false)" \
		--argjson wifioff "$(grep -q '^dtoverlay=disable-wifi' "${BOOT_CONFIG}" 2>/dev/null && echo true || echo false)" \
		--argjson btoff "$([ "$(systemctl is-enabled hciuart.service 2>/dev/null)" = "masked" ] && echo true || echo false)" \
		--arg governor "${governor}" \
		--argjson dhcp "$(grep -q '^[[:space:]]*timeout 10;' "${DHCP_CONF}" 2>/dev/null && echo true || echo false)" \
		--argjson usb "${usb}" \
		--argjson services "${services}" \
		--arg soundcard "${sound_card}" \
		--arg loglevel "${log_level}" \
		'{
			version: 1,
			boot: {
				display_hdmi_rotate: $hdmi, lcd_rotate: $lcd, display_lcd_rotate: $dlcd, initial_turbo: $turbo,
				avoid_warnings: $avoid, sdtweak: $sdtweak, onboard_wifi_off: $wifioff
			},
			bluetooth_chip_off: $btoff,
			dietpi: { cpu_governor: $governor },
			network: { dhcp_timeout_10: $dhcp, usb_wifi_power: $usb },
			services: $services,
			soundcard: $soundcard,
			spotify_log_level: $loglevel
		}' > "${tmp}" || { rm -f "${tmp}"; exit 1; }

	# only replaced when the file could be written completely
	cp "${tmp}" "${out}" && chmod 600 "${out}"
	rm -f "${tmp}"
}

inject() { # <key=> <key=value> <file>
	( . /boot/dietpi/func/dietpi-globals && G_CONFIG_INJECT "$1" "$2" "$3" ) >/dev/null 2>&1
}

apply_settings() {
	local in="$1"
	[ -s "${in}" ] && jq -e . "${in}" >/dev/null 2>&1 || { echo "No valid settings file: ${in}"; exit 1; }
	local value

	# --- /boot/config.txt ---
	for key in display_hdmi_rotate lcd_rotate display_lcd_rotate; do
		value=$(jq -r --arg k "${key}" '.boot[$k] // empty' "${in}")
		# only plain numbers (also 0x10000 style values), never anything else into the boot file
		if [[ "${value}" =~ ^(0x[0-9a-fA-F]+|[0-9]+)$ ]]; then
			inject "${key}=" "${key}=${value}" "${BOOT_CONFIG}"
		fi
	done
	value=$(jq -r '.boot.initial_turbo // empty' "${in}")
	if [[ "${value}" =~ ^[0-9]+$ ]]; then
		inject "initial_turbo" "initial_turbo=${value}" "${BOOT_CONFIG}"
	fi
	value=$(jq -r 'if .boot.avoid_warnings == null then "" else (.boot.avoid_warnings|tostring) end' "${in}")
	if [ "${value}" = "true" ] && ! grep -q '^avoid_warnings=1' "${BOOT_CONFIG}"; then
		[ -n "$(tail -c1 "${BOOT_CONFIG}")" ] && echo >> "${BOOT_CONFIG}"
		echo 'avoid_warnings=1' >> "${BOOT_CONFIG}"
	elif [ "${value}" = "false" ]; then
		sed -i '/^avoid_warnings=1[[:space:]]*$/d' "${BOOT_CONFIG}"
	fi
	value=$(jq -r 'if .boot.sdtweak == null then "" else (.boot.sdtweak|tostring) end' "${in}")
	if [ "${value}" = "true" ] && ! grep -q 'dtoverlay=sdtweak,overclock_50=100' "${BOOT_CONFIG}"; then
		[ -n "$(tail -c1 "${BOOT_CONFIG}")" ] && echo >> "${BOOT_CONFIG}"
		echo 'dtoverlay=sdtweak,overclock_50=100' >> "${BOOT_CONFIG}"
	elif [ "${value}" = "false" ]; then
		sed -i '/^dtoverlay=sdtweak,overclock_50=100[[:space:]]*$/d' "${BOOT_CONFIG}"
	fi
	value=$(jq -r 'if .boot.onboard_wifi_off == null then "" else (.boot.onboard_wifi_off|tostring) end' "${in}")
	[ "${value}" = "true" ] && CONFIG="${BOOT_CONFIG}" /usr/local/bin/mupibox/set_onboard_wifi.sh off
	[ "${value}" = "false" ] && CONFIG="${BOOT_CONFIG}" /usr/local/bin/mupibox/set_onboard_wifi.sh on

	# --- Bluetooth chip, CPU governor ---
	value=$(jq -r 'if .bluetooth_chip_off == null then "" else (.bluetooth_chip_off|tostring) end' "${in}")
	[ "${value}" = "true" ] && /usr/local/bin/mupibox/set_bluetooth_chip.sh off
	[ "${value}" = "false" ] && /usr/local/bin/mupibox/set_bluetooth_chip.sh on
	value=$(jq -r '.dietpi.cpu_governor // empty' "${in}")
	if [[ "${value}" =~ ^[a-z]+$ ]]; then
		inject "CONFIG_CPU_GOVERNOR=" "CONFIG_CPU_GOVERNOR=${value}" "${DIETPI_TXT}"
	fi

	# --- network ---
	value=$(jq -r 'if .network.dhcp_timeout_10 == null then "" else (.network.dhcp_timeout_10|tostring) end' "${in}")
	[ "${value}" = "true" ] && sed -i 's/#timeout 60;/timeout 10;/g' "${DHCP_CONF}"
	[ "${value}" = "false" ] && sed -i 's/timeout 10;/#timeout 60;/g' "${DHCP_CONF}"
	local module conf
	for module in ${USB_WIFI_MODULES}; do
		value=$(jq -r --arg m "${module}" '.network.usb_wifi_power[$m] // empty' "${in}")
		if [[ "${value}" =~ ^[0-2]$ ]]; then
			conf="${MODPROBE_DIR}/${module}.conf"
			if [ -f "${conf}" ] && grep -Eq "^options[[:space:]]+${module}\b" "${conf}"; then
				if grep -Eq "^options[[:space:]]+${module}\b.*rtw_power_mgnt=" "${conf}"; then
					sed -i -E "/^options[[:space:]]+${module}/ s/rtw_power_mgnt=[0-9]+/rtw_power_mgnt=${value}/" "${conf}"
				else
					sed -i -E "/^options[[:space:]]+${module}/ s/\$/ rtw_power_mgnt=${value}/" "${conf}"
				fi
			else
				echo "options ${module} rtw_power_mgnt=${value}" >> "${conf}"
			fi
		fi
	done

	# --- services (switched on or off for the next start; the reboot after a restore starts them) ---
	local unit
	for unit in ${SERVICES}; do
		value=$(jq -r --arg u "${unit}" 'if .services[$u] == null then "" else (.services[$u]|tostring) end' "${in}")
		if [ -n "${value}" ] && unit_exists "${unit}"; then
			[ "${value}" = "true" ] && systemctl enable "${unit}.service" >/dev/null 2>&1
			[ "${value}" = "false" ] && systemctl disable "${unit}.service" >/dev/null 2>&1
		fi
	done

	# --- sound card (the name itself is restored with mupiboxconfig.json) ---
	value=$(jq -r '.soundcard // empty' "${in}")
	if [[ "${value}" =~ ^[A-Za-z0-9_.-]+$ ]]; then
		/boot/dietpi/func/dietpi-set_hardware soundcard "${value}" >/dev/null 2>&1
	fi

	# --- log level of the Spotify controller ---
	value=$(jq -r '.spotify_log_level // empty' "${in}")
	if [[ "${value}" =~ ^(error|debug)$ ]] && [ -f "${SPOTIFY_CONFIG}" ]; then
		sed -i -E "s/\"logLevel\": *\"(error|debug)\"/\"logLevel\": \"${value}\"/" "${SPOTIFY_CONFIG}"
	fi
}

case "$1" in
	export) [ -n "$2" ] || { echo "usage: $0 export <file>"; exit 1; }; export_settings "$2" ;;
	apply) [ -n "$2" ] || { echo "usage: $0 apply <file>"; exit 1; }; apply_settings "$2" ;;
	*) echo "usage: $0 export|apply <file>"; exit 1 ;;
esac
