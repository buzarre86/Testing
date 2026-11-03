"""Hantar notifikasi kepada bos melalui Telegram dan/atau email.

Saluran yang tidak dikonfigurasi akan dilangkau. Setiap notifikasi juga
sentiasa direkod dalam fail log (notifikasi.log) sebagai sandaran.
"""

import json
import os
import smtplib
import urllib.parse
import urllib.request
from datetime import datetime
from email.message import EmailMessage

FAIL_LOG = os.environ.get("FAIL_LOG_NOTIFIKASI", "notifikasi.log")


def _telegram(mesej):
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not (token and chat_id):
        return None
    data = urllib.parse.urlencode({"chat_id": chat_id, "text": mesej}).encode()
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    with urllib.request.urlopen(url, data=data, timeout=15) as resp:
        if not json.load(resp).get("ok"):
            raise RuntimeError("Telegram menolak mesej")
    return "telegram"


def _email(subjek, mesej):
    host = os.environ.get("SMTP_HOST")
    pengguna = os.environ.get("SMTP_USER")
    kata_laluan = os.environ.get("SMTP_PASSWORD")
    emel_bos = os.environ.get("EMAIL_BOS")
    if not (host and pengguna and kata_laluan and emel_bos):
        return None
    msg = EmailMessage()
    msg["Subject"] = subjek
    msg["From"] = pengguna
    msg["To"] = emel_bos
    msg.set_content(mesej)
    with smtplib.SMTP(host, int(os.environ.get("SMTP_PORT", "587")), timeout=20) as s:
        s.starttls()
        s.login(pengguna, kata_laluan)
        s.send_message(msg)
    return "email"


def maklum_bos(subjek, mesej):
    """Hantar mesej kepada bos. Pulangkan ringkasan saluran yang berjaya/gagal."""
    berjaya, gagal = [], []
    for nama, fn in (("telegram", lambda: _telegram(f"{subjek}\n\n{mesej}")),
                     ("email", lambda: _email(subjek, mesej))):
        try:
            hasil = fn()
            if hasil:
                berjaya.append(hasil)
        except Exception as e:  # jangan biar satu saluran gagal hentikan yang lain
            gagal.append(f"{nama} ({e})")

    masa = datetime.now().isoformat(timespec="seconds")
    with open(FAIL_LOG, "a", encoding="utf-8") as f:
        f.write(f"[{masa}] {subjek}\n{mesej}\n\n")
    print(f"\n📣 [Notifikasi bos] {subjek}\n{mesej}\n")

    ringkasan = f"Dihantar melalui: {', '.join(berjaya) or 'log sahaja (tiada saluran dikonfigurasi)'}"
    if gagal:
        ringkasan += f". Gagal: {', '.join(gagal)}"
    return ringkasan
