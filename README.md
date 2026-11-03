# 🤖 Agent Inventori

AI agent (guna Claude) untuk urus inventori kedai. Staf taip arahan dalam bahasa biasa,
agent kemas kini stok, dan **setiap kali stok berkurang, bos dimaklumkan secara automatik**
melalui Telegram dan/atau email.

## Contoh penggunaan

```
Anda: jual 3 beg coach
📣 [Notifikasi bos] ⚠️ STOK RENDAH: Beg Coach
Produk : Beg Coach
Kurang : 3 unit (jualan)
Stok   : 5 → 2 unit
Minimum: 2 unit

Agent: Siap! 3 unit Beg Coach ditolak. Baki 2 unit (paras minimum). Bos sudah dimaklumkan.

Anda: stok masuk 10 jam casio
Anda: ada barang yang stok tinggal sikit?
Anda: 1 dompet guess rosak
```

## Cara pasang

```bash
pip install -r requirements.txt
cp .env.example .env      # kemudian isi ANTHROPIC_API_KEY dan saluran notifikasi
python agent.py
```

### Tetapkan saluran notifikasi bos (pilih satu atau kedua-dua)

**Telegram (disyorkan, percuma dan segera)**
1. Di Telegram, cari `@BotFather` → `/newbot` → salin token ke `TELEGRAM_BOT_TOKEN`.
2. Bos perlu tekan **Start** pada bot itu sekali.
3. Dapatkan chat ID bos (cth. melalui `@userinfobot`) → `TELEGRAM_CHAT_ID`.

**Email (Gmail)**
1. Aktifkan 2-Step Verification, kemudian cipta *App Password* di akaun Google.
2. Isi `SMTP_USER`, `SMTP_PASSWORD` (App Password) dan `EMAIL_BOS`.

Jika tiada saluran diisi, notifikasi tetap dipaparkan di skrin dan direkod dalam `notifikasi.log`.

## Struktur fail

| Fail | Fungsi |
|---|---|
| `agent.py` | Gelung agent, tools dan system prompt |
| `inventori.py` | Baca/tulis stok dalam `inventori.json` |
| `notifikasi.py` | Hantar mesej kepada bos (Telegram, email, log) |
| `inventori.json` | Data stok (contoh). Ubah ikut produk sebenar |

## Bagaimana ia berfungsi

- Notifikasi pengurangan stok dibuat **dalam kod** (`proses_kurang_stok`), bukan diserahkan
  kepada AI, jadi bos tidak akan terlepas apa-apa pengurangan.
- Stok tidak boleh jadi negatif. Jika staf cuba keluarkan lebih daripada stok, agent akan beritahu.
- Jika stok ≤ `stok_minimum`, mesej ditanda **⚠️ STOK RENDAH**; jika 0, ditanda **HABIS**.
