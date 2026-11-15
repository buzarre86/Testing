# 📦 Pemerhati Stok → Telegram bos (Google Apps Script)

Skrip ini dipasang **di dalam Google Sheet stok anda**. Bos terus dapat mesej Telegram bila:

- nilai lajur stok (**Baki** / **Stok**) **turun**,
- nilai lajur **Status** **bertukar** (cth. `Ada → Terjual`), atau
- produk **dipadam** dari sheet.

Percuma, dan tak perlu komputer sentiasa hidup.

| Siapa ubah stok | Bila bos dapat mesej |
|---|---|
| Staf ubah sheet dengan tangan | Serta-merta (beberapa saat) |
| Program lain / API (cth. `agent.py`) | Dalam masa ~5 minit |

Contoh mesej yang bos terima:

```
📦 Galoshire Stok
Diubah oleh: staf@kedai.com

❗ HABIS: Coach Willow Tote [GS002]
Kurang : 1 unit
Baki   : 1 → 0 unit
Status : Ada → Habis
Sila restock segera.
```

Stok naik (restock) dan produk baru **tidak** dihantar notifikasi. Perubahan huruf besar/kecil
sahaja pada status (cth. `terjual → Terjual`) juga diabaikan.

---

## Langkah pemasangan (±10 minit)

### 1. Pastikan format sheet betul

Skrip baca tajuk di baris pertama tab stok (huruf besar/kecil tak penting):

| Lajur | Nama tajuk yang diterima | Wajib? |
|---|---|---|
| Kod produk | `kod`, `sku`, `kod produk` | Disyorkan (pengenalan unik) |
| Nama produk | `nama`, `nama produk`, `produk` | ✅ |
| Jumlah stok | `baki`, `stok`, `kuantiti`, `qty` | ✅ |
| Brand | `brand`, `jenama` | Pilihan (dipaparkan dalam mesej) |
| Status | `status` | Pilihan (bos dimaklumkan bila status bertukar) |

Lajur lain (harga, jenis, tarikh dan sebagainya) diabaikan. Contoh sheet yang serasi:

| kod | nama | brand | jenis | harga | baki | status |
|---|---|---|---|---|---|---|
| GS001 | Tabby Shoulder Bag 26 | Coach | Beg | 1599 | 3 | Ada |

Skrip guna **tab pertama**. Kalau stok di tab lain, tukar `NAMA_TAB` di bahagian atas `Code.gs`.

### 2. Cipta bot Telegram

1. Di Telegram, cari **@BotFather** dan hantar `/newbot`.
2. Beri nama bot (cth. `Stok Kedai`) dan username (mesti berakhir `bot`, cth. `StokKedaiBot`).
3. BotFather akan beri **token** seperti `123456789:AAH...`. Simpan dulu.

### 3. Masukkan skrip ke dalam Google Sheet

1. Buka Google Sheet stok → menu **Extensions → Apps Script**.
2. Padam semua kod sedia ada dalam `Code.gs`.
3. Salin **semua** isi fail [`Code.gs`](Code.gs) ini dan tampal di situ.
4. Tekan ikon 💾 **Save**.
5. Kembali ke Google Sheet dan **refresh** halaman. Menu baru **🤖 Inventori** akan muncul.

### 4. Sambungkan Telegram (guna menu 🤖 Inventori)

1. **1. Masukkan token bot Telegram**: tampal token dari langkah 2.
   - Kali pertama, Google akan minta kebenaran (*Authorization required*). Tekan **Continue**,
     pilih akaun anda, **Advanced → Go to ... (unsafe) → Allow**. Ini normal untuk
     skrip yang anda pasang sendiri.
2. Hantar pautan bot (cth. `t.me/StokKedaiBot`) kepada bos. Bos buka dan tekan **START**.
3. **2. Cari chat ID bos**: pilih nama bos bila ditanya.
4. **3. Hantar mesej ujian**: bos patut terima mesej ✅ di Telegram.
5. **4. Hidupkan pemerhati stok**: siap!

Sekarang cuba tukar stok satu produk ke nombor lebih kecil. Bos patut terima mesej
dalam beberapa saat.

---

## Soalan lazim

**Macam mana nak berhenti?** Menu **🤖 Inventori → Matikan pemerhati stok**.

**Nak tukar bos / tambah orang lain?** Orang baru tekan START pada bot, kemudian jalankan
semula menu **2. Cari chat ID bos**. (Sekarang hanya seorang penerima.)

**Saya kosongkan sel stok sekejap, bos dapat mesej ke?** Tidak. Sel kosong diabaikan
sampai diisi semula.

**Telegram tergendala?** Mesej akan dicuba semula pada semakan berjadual seterusnya.

**Saya juga guna `agent.py`, bos dapat dua mesej?** Ya, sebab kedua-duanya hantar
notifikasi. Jika guna pemerhati ini, kosongkan `TELEGRAM_CHAT_ID` dalam `.env` agent
supaya hanya pemerhati yang hantar.

**Token selamat?** Token disimpan dalam *Script Properties* (bukan dalam sel sheet), jadi
staf yang hanya boleh edit sheet tidak nampak token. Pemilik skrip sahaja yang boleh lihat.
