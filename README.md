# 🤖 Agent Inventori

AI agent (guna Claude) untuk urus inventori kedai yang disimpan dalam **Google Sheets**.
Staf taip arahan dalam bahasa biasa, agent kemas kini sheet, dan **setiap kali stok
berkurang, bos dimaklumkan secara automatik melalui Telegram**.

## Contoh penggunaan

```
Anda: jual 3 beg coach
📣 [Notifikasi bos] ⚠️ STOK RENDAH: Beg Coach
Produk : Beg Coach
Kurang : 3 unit (jualan)
Stok   : 5 → 2 unit
Minimum: 2 unit

Agent: Siap! 3 unit Beg Coach ditolak. Baki 2 unit. Bos sudah dimaklumkan.

Anda: stok masuk 10 jam casio
Anda: ada barang yang stok tinggal sikit?
Anda: 1 dompet guess rosak
```

## Cara pasang

```bash
pip install -r requirements.txt
cp .env.example .env      # isi nilai mengikut langkah di bawah
python agent.py
```

### 1. Sediakan Google Sheet

Baris pertama sheet mesti ada tajuk berikut (huruf besar/kecil tak penting):

| Nama | Stok | Stok Minimum | Dikemas Kini |
|---|---|---|---|
| Beg Coach | 5 | 2 | |
| Jam Casio | 8 | 3 | |

`Nama` dan `Stok` wajib. `Stok Minimum` (paras amaran) dan `Dikemas Kini` (masa
dikemas kini, diisi oleh agent) adalah pilihan.

### 2. Beri agent akses ke Google Sheet (service account)

1. Pergi ke <https://console.cloud.google.com>, cipta projek baru.
2. **APIs & Services → Library**: aktifkan **Google Sheets API** dan **Google Drive API**.
3. **APIs & Services → Credentials → Create credentials → Service account**. Siapkan.
4. Klik service account tersebut → **Keys → Add key → JSON**. Fail akan dimuat turun.
   Namakan semula fail itu `service_account.json` dan letak dalam folder projek ini.
5. Buka fail JSON itu, salin nilai `client_email` (cth. `agent@projek.iam.gserviceaccount.com`).
6. Di Google Sheet anda, tekan **Share** dan kongsi dengan emel tersebut sebagai **Editor**.
7. Salin ID sheet dari pautan ke `GOOGLE_SHEET_ID` dalam `.env`:
   `https://docs.google.com/spreadsheets/d/`**`<ID ini>`**`/edit`

### 3. Sediakan Telegram untuk bos

> Bot Telegram **tidak boleh** hantar mesej ke nombor telefon secara terus. Ini peraturan
> Telegram untuk elak spam. Bos perlu "Start" bot sekali, kemudian bot tahu siapa bos.

1. Di Telegram, cari **@BotFather** → hantar `/newbot` → ikut arahan. Salin token yang
   diberi ke `TELEGRAM_BOT_TOKEN` dalam `.env`.
2. Hantar pautan bot (cth. `t.me/NamaBotAnda_bot`) kepada bos. Bos buka dan tekan **Start**.
3. Jalankan `python cari_chat_id.py`. Ia akan papar chat ID bos.
4. Salin ke `TELEGRAM_CHAT_ID` dalam `.env`.

Jika Telegram belum disediakan, notifikasi tetap dipaparkan di skrin dan direkod dalam
`notifikasi.log`.

## Struktur fail

| Fail | Fungsi |
|---|---|
| `agent.py` | Gelung agent, tools dan system prompt |
| `inventori.py` | Baca/tulis stok di Google Sheets (atau `inventori.json` jika `GOOGLE_SHEET_ID` kosong, untuk cubaan) |
| `notifikasi.py` | Hantar mesej kepada bos melalui Telegram |
| `cari_chat_id.py` | Bantu cari chat ID Telegram bos |
| `inventori.json` | Data contoh untuk cubaan tanpa Google Sheet |

## Bagaimana ia berfungsi

- Notifikasi pengurangan stok dibuat **dalam kod** (`proses_kurang_stok`), bukan diserahkan
  kepada AI, jadi bos tidak akan terlepas apa-apa pengurangan.
- Agent sentiasa baca nilai terkini dari sheet sebelum tolak stok.
- Stok tidak boleh jadi negatif. Jika staf cuba keluarkan lebih daripada stok, agent akan beritahu.
- Jika stok ≤ `Stok Minimum`, mesej ditanda **⚠️ STOK RENDAH**; jika 0, ditanda **HABIS**.

## Keselamatan

`.env` dan `service_account.json` mengandungi kunci rahsia dan sudah dimasukkan dalam
`.gitignore`. Jangan sesekali commit atau kongsi fail-fail ini.
