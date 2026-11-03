"""Cari TELEGRAM_CHAT_ID bos.

Langkah:
1. Isi TELEGRAM_BOT_TOKEN dalam .env.
2. Minta bos buka bot anda di Telegram dan tekan "Start" (atau hantar apa-apa mesej).
3. Jalankan: python cari_chat_id.py
4. Salin chat ID bos ke TELEGRAM_CHAT_ID dalam .env.
"""

import json
import os
import urllib.request

from agent import muat_env

muat_env()
token = os.environ.get("TELEGRAM_BOT_TOKEN")
if not token:
    raise SystemExit("Isi TELEGRAM_BOT_TOKEN dalam .env dahulu.")

with urllib.request.urlopen(f"https://api.telegram.org/bot{token}/getUpdates", timeout=15) as r:
    kemas_kini = json.load(r).get("result", [])

dijumpai = {}
for u in kemas_kini:
    chat = (u.get("message") or u.get("my_chat_member") or {}).get("chat")
    if chat:
        nama = " ".join(filter(None, [chat.get("first_name"), chat.get("last_name")])) or chat.get("title")
        dijumpai[chat["id"]] = f"{nama} (@{chat.get('username', '-')})"

if not dijumpai:
    print("Tiada mesej dijumpai. Pastikan bos sudah tekan 'Start' pada bot, kemudian cuba lagi.")
for chat_id, nama in dijumpai.items():
    print(f"TELEGRAM_CHAT_ID={chat_id}    ← {nama}")
