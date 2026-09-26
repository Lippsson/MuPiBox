<?php
// Builds a zip archive and sends it as a download, then deletes it.
//
// The download pages used to write fixed names into the web root (/var/www/config_backup.zip,
// full_backup.zip, pm2_logs.zip, support_data.zip) and left them there. Only the page that
// builds the archive checks the login - the file itself was then served by lighttpd as a static
// file to anyone in the LAN, and config_backup.zip holds the whole mupiboxconfig.json with all
// credentials. Now the archive is built outside the web root under a random name and removed
// right after sending (also when the browser aborts the download).
//
// /var/tmp, not /tmp: /tmp is a RAM disk of 1 GB and a full backup contains the whole media
// folder (many GB).
//
// $sources is a fixed, caller-supplied list of paths (may contain shell globs); it must never
// contain request data.

// The files of the configuration backup that hold the settings (used by the config and the full backup).
// Besides mupiboxconfig.json and data.json these are the settings that live in the system itself: the WiFi
// networks (wpa_supplicant.conf, wlan.json), the paired Bluetooth devices and a small file with the boot,
// driver and service settings, which is written just now (see scripts/mupibox/system_settings.sh).
function mupibox_settings_backup_sources(): string {
	exec('sudo /usr/local/bin/mupibox/system_settings.sh export /etc/mupibox/system-settings.json');
	$sources = array(
		'/etc/mupibox/mupiboxconfig.json',
		'/etc/mupibox/system-settings.json',
		'/home/dietpi/.mupibox/Sonos-Kids-Controller-master/server/config/data.json',
		'/home/dietpi/.mupibox/Sonos-Kids-Controller-master/server/config/wlan.json',
		'/etc/wpa_supplicant/wpa_supplicant.conf',
		'/var/lib/bluetooth',
	);
	// a file that does not exist (no Bluetooth, no wlan.json yet) is left out instead of making zip fail
	$existing = array();
	foreach ($sources as $source) {
		$check = 'sudo test -e ' . escapeshellarg($source);
		exec($check, $ignored, $missing);
		if ($missing === 0) {
			$existing[] = escapeshellarg($source);
		}
	}
	return implode(' ', $existing);
}

function mupibox_send_zip(string $downloadName, string $zipOptions, string $sources): void {
	$path = '/var/tmp/mupibox-download-' . bin2hex(random_bytes(12)) . '.zip';
	ignore_user_abort(true);
	register_shutdown_function(function () use ($path) {
		exec('sudo rm -f ' . escapeshellarg($path));
	});

	exec('sudo zip -q ' . $zipOptions . ' ' . escapeshellarg($path) . ' ' . $sources);
	exec('sudo chown www-data:www-data ' . escapeshellarg($path) . ' && sudo chmod 600 ' . escapeshellarg($path));
	clearstatcache();
	if (!is_file($path)) {
		http_response_code(500);
		header('Content-Type: text/plain; charset=utf-8');
		echo "Could not create the archive.\n";
		exit;
	}

	while (ob_get_level() > 0) {
		ob_end_clean();
	}
	header('Content-Description: File Transfer');
	header('Content-Type: application/zip');
	header('Cache-Control: no-store');
	header('Expires: 0');
	header('Content-Disposition: attachment; filename="' . $downloadName . '"');
	header('Content-Length: ' . filesize($path));
	readfile($path);
	exit;
}
