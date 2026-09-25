#!/usr/bin/python3
# Sends a message to all configured Telegram chats, in the bot's language (see telegram_i18n.py):
#   telegram_send_message.py "text"                       known fixed texts are translated, others sent as they are
#   telegram_send_message.py --key <key> [name=value ...]  a text from telegram_i18n.TEXTS with its placeholders

import sys
import telepot
import json
from telegram_chats import normalize_chat_ids, send_to_all
from telegram_i18n import translate_message, tr

with open("/etc/mupibox/mupiboxconfig.json") as file:
    config = json.load(file)

if not config['telegram']['active']:
    quit()

chat_ids = normalize_chat_ids(config['telegram'].get('chatId'))
if not chat_ids:
    quit()

if len(sys.argv) >= 3 and sys.argv[1] == '--key':
    values = dict(arg.split('=', 1) for arg in sys.argv[3:] if '=' in arg)
    message = tr(sys.argv[2], **values)
elif len(sys.argv) >= 2:
    message = translate_message(sys.argv[1])
else:
    quit()

bot = telepot.Bot(config['telegram']['token'])
send_to_all(bot, message, chat_ids)

if config['mupihat']['hat_active']:
    with open("/tmp/mupihat.json") as file:
        mupihat = json.load(file)
    if mupihat['BatteryConnected']:
        send_to_all(bot, tr('n_battery', soc=mupihat['Bat_SOC']), chat_ids)
