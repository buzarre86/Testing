"""Hantar notifikasi kepada bos melalui Telegram.

Nota: Bot Telegram TIDAK boleh hantar mesej terus ke nombor telefon. Bos perlu
tekan "Start" pada bot sekali, kemudian jalankan `python cari_chat_id.py` untuk
dapatkan TELEGRAM_CHAT_ID bos.

Setiap notifikasi juga sentiasa direkod dalam notifikasi.log sebagai sandaran.
"""

import json
import os
import urllib.parse
import urllib.request
from datetime import datetime

FAIL_LOG = os.environ.get("FAIL_LOG_NOTIFIKASI", "notifikasi.log")


def hantar_telegram(mesej):
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not (token and chat_id):
        return False
    data = urllib.parse.urlencode({"chat_id": chat_id, "text": mesej}).encode()
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    with urllib.request.urlopen(url, data=data, timeout=15) as resp:
        if not json.load(resp).get("ok"):
            raise RuntimeError("Telegram menolak mesej")
    return True


def maklum_bos(subjek, mesej):
    """Hantar mesej kepada bos. Pulangkan status penghantaran."""
    teks = f"{subjek}\n\n{mesej}"
    try:
        status = "Dihantar ke Telegram bos" if hantar_telegram(teks) else \
            "BELUM dihantar: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID belum diisi (direkod dalam log sahaja)"
    except Exception as e:
        status = f"GAGAL hantar ke Telegram ({e}); direkod dalam log sahaja"

    masa = datetime.now().isoformat(timespec="seconds")
    with open(FAIL_LOG, "a", encoding="utf-8") as f:
        f.write(f"[{masa}] {teks}\n[{status}]\n\n")
    print(f"\n📣 [Notifikasi bos] {teks}\n({status})\n")
    return status
