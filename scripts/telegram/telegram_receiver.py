#!/usr/bin/python3

import sys
import time
import telepot
import json
import subprocess
import requests
from telepot.loop import MessageLoop
from telepot.namedtuple import InlineKeyboardMarkup, InlineKeyboardButton

with open("/etc/mupibox/mupiboxconfig.json") as file:
    config = json.load(file)

if not config['telegram']['active']:
    quit()

PLAYTIME_DAY_KEYS = {'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'}

def _normalize_chat_ids(value):
    """telegram.chatId may be a single string/number (legacy), an array of
    strings/numbers, or an array of {id, label?} objects (current format).
    Return a list of stringified IDs."""
    if not value:
        return []
    if isinstance(value, (str, int, float)):
        s = str(value).strip()
        return [s] if s else []
    if isinstance(value, list):
        out = []
        for item in value:
            if isinstance(item, (str, int, float)):
                s = str(item).strip()
                if s:
                    out.append(s)
            elif isinstance(item, dict):
                cid = str(item.get('id', '')).strip()
                if cid:
                    out.append(cid)
        return out
    return []

# Authorization: only respond to messages from configured chats. Without this
# anyone who learns the bot username could send /shutdown / /quietnow / etc.
# An empty list is treated as "deny all" — the user has to configure one for
# outbound notifications anyway.
ALLOWED_CHAT_IDS = set(_normalize_chat_ids(config['telegram'].get('chatId')))

# Backend-API base URL on the same host. Used for parent-control commands
# (extend / release / quietnow / status). The player listens for config
# changes via fs.watch, so changes apply within ~50 ms.
API_BASE = 'http://localhost:8200/api'

def is_authorized(chat_id):
    if not ALLOWED_CHAT_IDS:
        print('Refusing message: no chatId configured in mupiboxconfig.json')
        return False
    return str(chat_id) in ALLOWED_CHAT_IDS

def fmt_minutes(seconds):
    if seconds <= 0:
        return '0 min'
    if seconds < 60:
        return '<1 min'
    return f'{seconds // 60} min'

def parse_int_arg(command, default=None):
    parts = command.split()
    if len(parts) >= 2:
        try:
            return int(parts[1])
        except (ValueError, TypeError):
            return default
    return default

# AR5-2: /vol used to splice the raw post-arg into "<N>%" and pass it
# straight to amixer — no range check, no maxVolume cap. The Hörschutz
# clamp from MED-1 lives only in the backend-player setVolume() flow,
# so the Telegram /vol path was an unauthenticated bypass for any
# whitelisted chat. Plus IndexError if /vol is sent without an arg
# crashed the receiver thread (AR5-7). This helper handles both.
def clamp_volume(raw):
    try:
        v = int(raw)
    except (ValueError, TypeError):
        return None
    max_vol = 100
    try:
        max_vol = int(config['mupibox'].get('maxVolume', 100))
    except (ValueError, TypeError, KeyError):
        pass
    return max(0, min(v, max_vol))

# AR5-7: /sleep <X> previously called int(split_cmd[1]) without try/except;
# /sleep without an arg was an IndexError that killed the receiver thread.
def clamp_sleep_minutes(raw):
    try:
        v = int(raw)
    except (ValueError, TypeError):
        return None
    return max(1, min(v, 1440))  # 1 min … 24 h

def call_api_post(path, body=None):
    try:
        r = requests.post(f'{API_BASE}{path}', json=(body or {}), timeout=5)
        return r.status_code, r.json() if r.headers.get('content-type', '').startswith('application/json') else r.text
    except Exception as e:
        return 0, str(e)

def call_api_get(path):
    try:
        r = requests.get(f'{API_BASE}{path}', timeout=5)
        return r.status_code, r.json() if r.headers.get('content-type', '').startswith('application/json') else r.text
    except Exception as e:
        return 0, str(e)

def format_status(status):
    if not status or status.get('enabled') is False:
        return 'Playtime/Quiet hours: <b>not configured</b>'
    state = status.get('state', 'normal')
    block_source = status.get('blockSource')
    pt = status.get('playtime', {}) or {}
    qh = status.get('quiet', {}) or {}
    ovr = status.get('override', {}) or {}
    lines = []
    if state == 'normal':
        lines.append('Status: <b>OK</b> (Wiedergabe erlaubt)')
    elif state == 'grace':
        lines.append(f'Status: <b>Grace</b> (Track läuft aus, Quelle: {block_source})')
    elif state == 'blocked':
        lines.append(f'Status: <b>BLOCKIERT</b> (Quelle: {block_source})')
    if pt.get('enabled'):
        used = int(pt.get('usedSeconds', 0))
        rem = int(pt.get('remainingSeconds', 0))
        limit = int(pt.get('limitMinutes', 0))
        lines.append(f'Playtime: {used // 60}/{limit} min, noch {fmt_minutes(rem)}')
    if qh.get('enabled'):
        if qh.get('inWindow'):
            label = qh.get('label', '')
            lines.append(f'Quiet hours: <b>aktiv</b>{f" ({label})" if label else ""}')
        else:
            lines.append('Quiet hours: ein, aber gerade kein Fenster aktiv')
    now_ms = int(time.time() * 1000)
    if int(ovr.get('forceBlockUntil', 0)) > now_ms:
        until = int(ovr['forceBlockUntil'])
        mins = (until - now_ms) // 60000
        lines.append(f'⛔ Force-Block aktiv für noch {mins} min')
    if int(ovr.get('allowUntil', 0)) > now_ms:
        until = int(ovr['allowUntil'])
        mins = (until - now_ms) // 60000
        lines.append(f'✅ Override aktiv für noch {mins} min')
    return '\n'.join(lines)

def help_keyboard():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Status",callback_data='status'), InlineKeyboardButton(text="Current Screen",callback_data='screen')],
        [InlineKeyboardButton(text="Pause",callback_data='pause'), InlineKeyboardButton(text="Play",callback_data='play')],
        [InlineKeyboardButton(text="+30 min",callback_data='extend_30'), InlineKeyboardButton(text="+60 min",callback_data='extend_60')],
        [InlineKeyboardButton(text="Release 60",callback_data='release_60'), InlineKeyboardButton(text="QuietNow 60",callback_data='quietnow_60')],
        [InlineKeyboardButton(text="Set Volume",callback_data='vol'), InlineKeyboardButton(text="Sleep Timer",callback_data='sleep')],
        [InlineKeyboardButton(text="Finish current album",callback_data='finishalbum'), InlineKeyboardButton(text="Update Media-DB",callback_data='media')],
        [InlineKeyboardButton(text="🔑 Parent login",callback_data='login')],
        [InlineKeyboardButton(text="🔄 Smart-Sync",callback_data='resync'), InlineKeyboardButton(text="Status (Sync)",callback_data='syncstatus')],
        [InlineKeyboardButton(text="Shutdown",callback_data='shutdown'), InlineKeyboardButton(text="Reboot",callback_data='reboot')]
    ])

def box_base_url():
    # Telegram only makes a link tappable when its host is a real domain or an IP
    # address; a bare host name like "MuPiBox" stays plain text. So use the LAN IP.
    ip = ''
    try:
        out = subprocess.run(['hostname', '-I'], capture_output=True, text=True, timeout=3).stdout.split()
        ip = next((a for a in out if '.' in a), '')
    except Exception:
        pass
    return f"http://{ip or config['mupibox'].get('host', 'localhost')}:8200"

def send_magic_link(chat_id, heading, button_text):
    # Issue a single-use magic link for the Eltern-WebApp. We post from
    # 127.0.0.1 so the localNetworkOnly gate accepts us; the receiver's
    # chatId-whitelist (is_authorized in on_chat_message) is the actual
    # auth boundary for who can request a link.
    status_code, body = call_api_post('/eltern/magic-link/generate', {'source': 'telegram'})
    if status_code != 201 or not isinstance(body, dict):
        bot.sendMessage(chat_id, f'Magic-Link konnte nicht erzeugt werden: {status_code} {body}')
        return
    url = box_base_url() + body.get('url_path', '/eltern')
    expires = body.get('expires_in', 900)
    text = f'{heading}\n\nGültig {expires // 60} Min — Single-Use.\n\n<a href="{url}">{button_text}</a>\n\n<code>{url}</code>'
    markup = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=button_text, url=url)]])
    try:
        bot.sendMessage(chat_id, text, parse_mode='HTML', disable_web_page_preview=True, reply_markup=markup)
    except Exception as e:
        # Telegram refuses button URLs it doesn't like; the text link still works then.
        print(f'Magic link with button failed ({e}), sending without')
        bot.sendMessage(chat_id, text, parse_mode='HTML', disable_web_page_preview=True)

def on_chat_message(msg):
    content_type, chat_type, chat_id = telepot.glance(msg)
    print(content_type, chat_type, chat_id)
    if not is_authorized(chat_id):
        print(f'Rejected message from unauthorized chat_id: {chat_id}')
        return
    if content_type != 'text':
        return
    command = msg['text']
    # In groups Telegram appends the bot's name to a tapped command ("/login@MyBot"); drop it.
    first, _, rest = command.partition(' ')
    command = first.split('@', 1)[0] + (' ' + rest if rest else '')
    if command == '/shutdown':
        subprocess.run(["sudo", "bash", "/usr/local/bin/mupibox/shutdown.sh"])
    elif command == '/screen':
        subprocess.run(["sudo", "rm", "/tmp/telegram_screen.png"])
        subprocess.run(["sudo", "-H", "-u", "dietpi", "bash", "-c", "DISPLAY=:0 scrot /tmp/telegram_screen.png"])
        bot.sendPhoto(chat_id, open('/tmp/telegram_screen.png', 'rb'))
    elif command == '/reboot':
        subprocess.run(["sudo", "reboot"])
    elif command[:4] == '/vol':
        # AR5-2 / AR5-7: validate, clamp to [0, maxVolume]; reject missing/non-int args.
        v = clamp_volume(parse_int_arg(command, default=None))
        if v is None:
            bot.sendMessage(chat_id, "Usage: /vol <0-maxVolume>")
        else:
            volume = f"{v}%"
            subprocess.run(["/usr/bin/amixer", "sset", "Master", volume])
            bot.sendMessage(chat_id, "Volume set to " + volume)
    elif command[:6] == '/sleep':
        # AR5-7: validate, reject missing/non-int args.
        mins = clamp_sleep_minutes(parse_int_arg(command, default=None))
        if mins is None:
            bot.sendMessage(chat_id, "Usage: /sleep <1-1440>")
        else:
            subprocess.Popen(["sudo", "nohup", "/usr/local/bin/mupibox/./sleep_timer.sh", str(mins * 60)])
            bot.sendMessage(chat_id, f"Sleep timer set to {mins} minutes")
    elif command == '/status':
        status_code, body = call_api_get('/playtime')
        if status_code == 200:
            bot.sendMessage(chat_id, format_status(body), parse_mode='HTML')
        else:
            bot.sendMessage(chat_id, f'Status-Abfrage fehlgeschlagen: {status_code} {body}')
    elif command[:7] == '/extend':
        mins = parse_int_arg(command, default=30)
        if mins is None or mins <= 0 or mins > 1440:
            bot.sendMessage(chat_id, 'Nutzung: /extend <Minuten>  (1..1440)')
        else:
            status_code, body = call_api_post('/playtime/extend', {'minutes': mins})
            if status_code == 200:
                bot.sendMessage(chat_id, f'✅ Heute +{mins} min Bonus hinzugefügt.')
            else:
                bot.sendMessage(chat_id, f'Fehler: {status_code} {body}')
    elif command[:8] == '/release':
        mins = parse_int_arg(command, default=60)
        if mins is None or mins <= 0 or mins > 1440:
            bot.sendMessage(chat_id, 'Nutzung: /release <Minuten>  (1..1440)')
        else:
            status_code, body = call_api_post('/playtime/release', {'minutes': mins})
            if status_code == 200:
                bot.sendMessage(chat_id, f'✅ Override aktiv für {mins} min — alle Blocks aus.')
            else:
                bot.sendMessage(chat_id, f'Fehler: {status_code} {body}')
    elif command[:9] == '/quietnow':
        mins = parse_int_arg(command, default=60)
        if mins is None or mins <= 0 or mins > 1440:
            bot.sendMessage(chat_id, 'Nutzung: /quietnow <Minuten>  (1..1440)')
        else:
            status_code, body = call_api_post('/quiethours/now', {'minutes': mins})
            if status_code == 200:
                bot.sendMessage(chat_id, f'⛔ Sofort-Stopp für {mins} min aktiviert.')
            else:
                bot.sendMessage(chat_id, f'Fehler: {status_code} {body}')
    elif command[:6] == '/limit':
        # Usage: /limit set <day> <minutes>   (day = mon..sun, minutes = 0..1440)
        # Mutates playtimeLimit.limitsMinutes.<day> in mupiboxconfig.json.
        # The player picks up the change via fs.watch within ~50 ms.
        parts = command.split()
        if len(parts) >= 4 and parts[1] == 'set':
            day = parts[2].lower()
            try:
                mins = int(parts[3])
            except (ValueError, TypeError):
                mins = -1
            if day not in PLAYTIME_DAY_KEYS or mins < 0 or mins > 1440:
                bot.sendMessage(chat_id, 'Nutzung: /limit set <mon|tue|wed|thu|fri|sat|sun> <Minuten 0..1440>')
            else:
                status_code, body = call_api_post('/playtime/limit', {'day': day, 'minutes': mins})
                if status_code == 200:
                    bot.sendMessage(chat_id, f'✅ Limit für {day} auf {mins} min gesetzt.')
                else:
                    bot.sendMessage(chat_id, f'Fehler: {status_code} {body}')
        else:
            bot.sendMessage(chat_id, 'Nutzung: /limit set <mon|tue|wed|thu|fri|sat|sun> <Minuten 0..1440>')
    elif command == '/help':
        bot.sendMessage(chat_id, 'Possible commands:', reply_markup=help_keyboard())
    elif command == '/command':
        bot.sendMessage(chat_id, "<b><u>Possible commands:</u></b>\n\n<code><b>/help</b></code>\n<i>shows the inline keyboard</i>\n\n<code><b>/status</b></code>\n<i>show current playtime + quiet hours status</i>\n\n<code><b>/extend</b> <i>[minutes, default 30]</i></code>\n<i>add bonus minutes to today's playtime cap</i>\n\n<code><b>/release</b> <i>[minutes, default 60]</i></code>\n<i>bypass all blocks for N minutes</i>\n\n<code><b>/quietnow</b> <i>[minutes, default 60]</i></code>\n<i>force-block playback for N minutes</i>\n\n<code><b>/limit set</b> <i>&lt;day&gt; &lt;minutes&gt;</i></code>\n<i>set the playtime limit for one weekday (mon..sun, 0..1440)</i>\n\n<b>Smart-Sync (Phase 14):</b>\n<code><b>/resync</b></code> — trigger Spotify sync now\n<code><b>/syncstatus</b></code> — show last sync result + status\n<code><b>/playlists</b></code> — list LeniBox-prefixed playlists found\n<code><b>/login</b></code> — magic link to Eltern-WebApp\n<code><b>/spotify_connect</b></code> — magic link incl. Spotify wizard\n<code><b>/spotify_disconnect</b></code> — stop Smart-Sync (with confirm)\n\n<b>System:</b>\n<code><b>/reboot</b></code>\n<code><b>/shutdown</b></code>\n<code><b>/screen</b></code>\n<code><b>/sleep</b> <i>[minutes]</i></code>\n<code><b>/vol</b> <i>[0-100]</i></code>\n<code><b>/media</b></code>\n<code><b>/finishalbum</b></code>", parse_mode='HTML')
    elif command == '/media':
        bot.sendMessage(chat_id, "Starting media data update... This take a while, please wait for complete message")
        subprocess.run(["sudo", "/usr/local/bin/mupibox/./m3u_generator.sh"])
        bot.sendMessage(chat_id, "Media update finished!")
    elif command == '/finishalbum':
        bot.sendMessage(chat_id, "After finishing the current album the MuPiBox will be shut down.")
        subprocess.run(["sudo", "/usr/local/bin/mupibox/./albumstop_activator.sh"])
    elif command == '/pause':
        bot.sendMessage(chat_id, "Pause")
        url = 'http://127.0.0.1:5005//pause'  # local: the player only takes commands from the box itself or its own pages
        requests.get(url, timeout=5)
    elif command == '/play':
        bot.sendMessage(chat_id, "Play")
        url = 'http://127.0.0.1:5005//play'  # local: the player only takes commands from the box itself or its own pages
        requests.get(url, timeout=5)
    # ── Phase 14d — Spotify Smart-Sync controls ────────────────────────
    elif command == '/resync':
        status_code, body = call_api_post('/spotify-sync/trigger?source=telegram', {})
        if status_code == 202:
            bot.sendMessage(chat_id, '🔄 Sync gestartet — Ergebnis kommt mit /syncstatus.')
        elif status_code == 429:
            wait = (body or {}).get('retry_after_seconds', 60) if isinstance(body, dict) else 60
            bot.sendMessage(chat_id, f'⏱ Cooldown aktiv — bitte in {wait} s erneut.')
        elif status_code == 409:
            bot.sendMessage(chat_id, '⏳ Es läuft bereits ein Sync.')
        elif status_code == 400:
            bot.sendMessage(chat_id, '⚠️ Smart-Sync ist nicht aktiviert. Aktiviere ihn in der Eltern-WebApp (/login).')
        else:
            bot.sendMessage(chat_id, f'Fehler: {status_code} {body}')
    elif command == '/syncstatus':
        status_code, body = call_api_get('/spotify-sync/status')
        if status_code != 200 or not isinstance(body, dict):
            bot.sendMessage(chat_id, f'Sync-Status-Abfrage fehlgeschlagen: {status_code}')
        else:
            state_info = body.get('state', {}) or {}
            token_info = body.get('token', {}) or {}
            enabled = '✅' if body.get('enabled') else '❌'
            last_status = state_info.get('last_sync_status', '—')
            last_end = state_info.get('last_sync_end') or '—'
            adds = state_info.get('additions_count', 0)
            upds = state_info.get('updates_count', 0)
            rems = state_info.get('removals_count', 0)
            confs = len(state_info.get('conflicts', []) or [])
            scopes_ok = '✅' if token_info.get('scopes_ok') else '❌'
            token_valid = '✅' if token_info.get('valid') else '❌'
            lines = [
                f'<b>Smart-Sync-Status</b>',
                f'Aktiv: {enabled}',
                f'Spotify-Token: gültig {token_valid}  ·  Berechtigungen: {scopes_ok}',
                f'Box-Playlist-Prefix: <code>{body.get("playlist_prefix", "?")}</code>',
                f'Polling-Intervall: {body.get("polling_interval_seconds", 0) // 60} min',
                f'',
                f'Letzter Sync: {last_status}',
                f'Zeitpunkt: {last_end}',
                f'+{adds}  ↻{upds}  −{rems}  Konflikte: {confs}',
            ]
            bot.sendMessage(chat_id, '\n'.join(lines), parse_mode='HTML')
    elif command == '/playlists':
        status_code, body = call_api_get('/spotify-sync/status')
        if status_code != 200 or not isinstance(body, dict):
            bot.sendMessage(chat_id, f'Playlists-Abfrage fehlgeschlagen: {status_code}')
        else:
            playlists = (body.get('state', {}) or {}).get('playlists_seen', []) or []
            if not playlists:
                bot.sendMessage(chat_id, 'Noch keine LeniBox-Playlists gefunden. Lege in Spotify eine Playlist an, deren Name mit dem Box-Playlist-Prefix beginnt (siehe /syncstatus).')
            else:
                lines = ['<b>Verbundene Playlists</b>']
                for p in playlists:
                    lines.append(f'📂 <code>{p.get("name", "?")}</code> · {p.get("items", 0)} Items')
                bot.sendMessage(chat_id, '\n'.join(lines), parse_mode='HTML')
    elif command in ('/login', '/eltern-login', '/eltern_login'):
        send_magic_link(chat_id, '🔑 <b>Eltern-Hub Login</b>', 'Hier öffnen')
    elif command in ('/spotify_connect', '/spotify-connect'):
        # Same flow as /login — the WebApp's setup wizard will
        # guide the user through Spotify OAuth.
        send_magic_link(chat_id, '🎵 <b>Spotify verbinden</b>\n\nÖffne den Link, klicke im Dashboard auf "Spotify einrichten".', 'Eltern-Hub öffnen')
    elif command in ('/spotify_disconnect', '/spotify-disconnect'):
        # Confirm-step inline keyboard so a fat-finger tap doesn't kill
        # an active token. Actual disconnect happens in the callback handler.
        markup = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text='✓ Ja, Spotify trennen', callback_data='spotify_disconnect_confirm')],
            [InlineKeyboardButton(text='✗ Abbrechen', callback_data='spotify_disconnect_cancel')],
        ])
        bot.sendMessage(
            chat_id,
            '⚠️ Spotify-Verbindung wirklich trennen?\n\nSmart-Sync stoppt und du musst dich neu autorisieren.',
            reply_markup=markup,
        )

def on_callback_query(msg):
    query_id, from_id, query_data = telepot.glance(msg, flavor='callback_query')
    # The buttons hang on the message that answered /help. In a group that chat
    # is the group (its id is what the parents allowed), not the person tapping,
    # so authorize and reply via the message's chat.
    keyboard_msg = msg.get('message') or {}
    chat_id = keyboard_msg.get('chat', {}).get('id', from_id)
    print('Callback Query:', query_id, chat_id, from_id, query_data)
    answered = False

    def answer(text=None, show_alert=True):
        # Telegram takes one answer per tap; it also stops the spinner on the button.
        nonlocal answered
        if answered:
            return
        answered = True
        try:
            bot.answerCallbackQuery(query_id, text=text, show_alert=show_alert)
        except Exception as e:
            print(f'answerCallbackQuery failed: {e}')

    if not (is_authorized(chat_id) or is_authorized(from_id)):
        print(f'Rejected callback from unauthorized chat_id {chat_id} / user_id {from_id}')
        answer('Not allowed', show_alert=False)
        return

    try:
        handle_callback(query_data, chat_id, keyboard_msg, answer)
    finally:
        answer(show_alert=False)

def handle_callback(query_data, chat_id, keyboard_msg, answer):
    if query_data == 'screen':
        subprocess.run(["sudo", "rm", "/tmp/telegram_screen.png"])
        subprocess.run(["sudo", "-H", "-u", "dietpi", "bash", "-c", "DISPLAY=:0 scrot /tmp/telegram_screen.png"])
        bot.sendPhoto(chat_id, open('/tmp/telegram_screen.png', 'rb'))
    elif query_data == 'status':
        status_code, body = call_api_get('/playtime')
        if status_code == 200:
            bot.sendMessage(chat_id, format_status(body), parse_mode='HTML')
        else:
            answer(text=f'Status-Abfrage fehlgeschlagen: {status_code}', show_alert=True)
    elif query_data[:7] == 'extend_':
        mins = int(query_data.split('_')[1])
        status_code, body = call_api_post('/playtime/extend', {'minutes': mins})
        if status_code == 200:
            answer(text=f'+{mins} min hinzugefügt', show_alert=True)
        else:
            answer(text=f'Fehler: {status_code}', show_alert=True)
    elif query_data[:8] == 'release_':
        mins = int(query_data.split('_')[1])
        status_code, body = call_api_post('/playtime/release', {'minutes': mins})
        if status_code == 200:
            answer(text=f'Override für {mins} min aktiv', show_alert=True)
        else:
            answer(text=f'Fehler: {status_code}', show_alert=True)
    elif query_data[:9] == 'quietnow_':
        mins = int(query_data.split('_')[1])
        status_code, body = call_api_post('/quiethours/now', {'minutes': mins})
        if status_code == 200:
            answer(text=f'Stop für {mins} min aktiviert', show_alert=True)
        else:
            answer(text=f'Fehler: {status_code}', show_alert=True)
    elif query_data == 'vol':
        markup = InlineKeyboardMarkup(inline_keyboard=[
                        [InlineKeyboardButton(text="10",callback_data='vol_10'), InlineKeyboardButton(text="20",callback_data='vol_20')],
                        [InlineKeyboardButton(text="30",callback_data='vol_30'), InlineKeyboardButton(text="40",callback_data='vol_40')],
                        [InlineKeyboardButton(text="50",callback_data='vol_50'), InlineKeyboardButton(text="60",callback_data='vol_60')],
                        [InlineKeyboardButton(text="70",callback_data='vol_70'), InlineKeyboardButton(text="80",callback_data='vol_80')],
                        [InlineKeyboardButton(text="90",callback_data='vol_90'), InlineKeyboardButton(text="Back",callback_data='back')]
                    ]
                )
        msg_idf = telepot.message_identifier(keyboard_msg)
        bot.editMessageText(msg_idf, 'What volume should set?', reply_markup = markup )
    elif query_data == 'sleep':
        markup = InlineKeyboardMarkup(inline_keyboard=[
                        [InlineKeyboardButton(text="5",callback_data='sleep_5'), InlineKeyboardButton(text="15",callback_data='sleep_15')],
                        [InlineKeyboardButton(text="30",callback_data='sleep_30'), InlineKeyboardButton(text="45",callback_data='sleep_45')],
                        [InlineKeyboardButton(text="60",callback_data='sleep_60'), InlineKeyboardButton(text="Back",callback_data='back')]
                    ]
                )
        msg_idf = telepot.message_identifier(keyboard_msg)
        bot.editMessageText(msg_idf, 'In how many minutes should the MuPiBox go to sleep?', reply_markup = markup )
    elif query_data[:4] == 'vol_':
        # Inline-keyboard values are hardcoded (10/30/50/70/100) but defense-
        # in-depth: clamp anyway so a future button change can't bypass
        # maxVolume. Same for /sleep_<N> below.
        parts = query_data.split("_", 1)
        v = clamp_volume(parts[1] if len(parts) > 1 else None)
        if v is None:
            answer(text='Invalid volume', show_alert=True)
        else:
            volume = f"{v}%"
            subprocess.run(["/usr/bin/amixer", "sset", "Master", volume])
            answer(text='Volume set to ' + volume, show_alert=True)
    elif query_data[:6] == 'sleep_':
        parts = query_data.split("_", 1)
        mins = clamp_sleep_minutes(parts[1] if len(parts) > 1 else None)
        if mins is None:
            answer(text='Invalid sleep value', show_alert=True)
        else:
            subprocess.Popen(["sudo", "nohup", "/usr/local/bin/mupibox/./sleep_timer.sh", str(mins * 60)])
            bot.sendMessage(chat_id, f"Sleep timer set to {mins} minutes")
    elif query_data == 'play':
        url = 'http://127.0.0.1:5005//play'  # local: the player only takes commands from the box itself or its own pages
        answer(text='Play', show_alert=True)
        requests.get(url, timeout=5)
    elif query_data == 'pause':
        url = 'http://127.0.0.1:5005//pause'  # local: the player only takes commands from the box itself or its own pages
        answer(text='Pause', show_alert=True)
        requests.get(url, timeout=5)
    elif query_data == 'back':
        msg_idf = telepot.message_identifier(keyboard_msg)
        bot.editMessageText(msg_idf, 'Possible commands:', reply_markup=help_keyboard())
    elif query_data == 'login':
        send_magic_link(chat_id, '🔑 <b>Eltern-Hub Login</b>', 'Hier öffnen')
    elif query_data == 'finishalbum':
        answer(text='After finishing the current album the MuPiBox will be shut down.', show_alert=True)
        bot.sendMessage(chat_id, "After finishing the current album the MuPiBox will be shut down.")
        subprocess.run(["sudo", "/usr/local/bin/mupibox/./albumstop_activator.sh"])
    elif query_data == 'shutdown':
        answer(text='MuPiBox shutdown!', show_alert=True)
        subprocess.run(["sudo", "bash", "/usr/local/bin/mupibox/shutdown.sh"])
    elif query_data == 'reboot':
        answer(text='MuPiBox reboot!', show_alert=True)
        subprocess.run(["sudo", "reboot"])
    elif query_data == 'media':
        answer(text='Starting media data update... This take a while, please wait for complete message.', show_alert=True)
        subprocess.run(["sudo", "/usr/local/bin/mupibox/./m3u_generator.sh"])
        bot.sendMessage(chat_id, "Media update finished!")
    # ── Phase 14d — Smart-Sync controls ──────────────────────────────────
    elif query_data == 'spotify_disconnect_confirm':
        # POST /api/eltern/spotify-oauth/disconnect needs a session cookie
        # AND csrf token — both of which we don't have from a Telegram-bot
        # context. Instead we clear via the underlying config: same effect
        # without going through the Eltern auth layer.
        # Use updateMupiboxConfig-equivalent: write spotify.refreshToken=''
        # via the existing setting_update path (sudo helper) — for now the
        # safest cross-platform way is to call the spotify-sync config
        # disable endpoint, which is unauthenticated for now.
        # Pragmatic stop-gap: just disable spotify_sync; full token-clear
        # is one extra step parents can do in the WebApp.
        sc, _ = call_api_post('/spotify-sync/config', {'enabled': False})
        if sc == 200:
            answer(text='Smart-Sync gestoppt. Token-Clear bitte in der Eltern-WebApp.', show_alert=True)
        else:
            answer(text=f'Fehler {sc}', show_alert=True)
    elif query_data == 'spotify_disconnect_cancel':
        answer(text='Abgebrochen.', show_alert=False)
    elif query_data == 'resync':
        sc, body = call_api_post('/spotify-sync/trigger?source=telegram', {})
        if sc == 202:
            answer(text='🔄 Sync gestartet.', show_alert=True)
        elif sc == 429:
            wait = (body or {}).get('retry_after_seconds', 60) if isinstance(body, dict) else 60
            answer(text=f'⏱ Cooldown — {wait}s warten.', show_alert=True)
        elif sc == 409:
            answer(text='⏳ Bereits in Bearbeitung.', show_alert=True)
        else:
            answer(text=f'Fehler {sc}', show_alert=True)
    elif query_data == 'syncstatus':
        sc, body = call_api_get('/spotify-sync/status')
        if sc == 200 and isinstance(body, dict):
            state_info = body.get('state', {}) or {}
            last_status = state_info.get('last_sync_status', '—')
            adds = state_info.get('additions_count', 0)
            upds = state_info.get('updates_count', 0)
            rems = state_info.get('removals_count', 0)
            answer(text=f'{last_status}  +{adds}/↻{upds}/−{rems}',
                show_alert=True,
            )
        else:
            answer(text=f'Fehler {sc}', show_alert=True)

TOKEN = config['telegram']['token']
bot = telepot.Bot(TOKEN)

MessageLoop(bot, {'chat': on_chat_message,
                  'callback_query': on_callback_query}).run_as_thread()
print ('Listening ...')

while 1:
    time.sleep(10)
