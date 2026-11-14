# Keputusan reka bentuk (sesi grill, 14 Nov 2026)

Rekod keputusan untuk versi baru Agent Inventori. Belum dilaksanakan dalam kod.

1. **Pengguna:** seorang sahaja. Tiada isu dua orang ubah stok serentak.
2. **Produk:**
   - `tambah_stok` tidak cipta produk baru. Jika nama tak jumpa, cadangkan nama paling hampir.
   - Produk baru ditambah secara manual dalam Google Sheet.
   - Model/warna dimasukkan dalam nama produk (cth. "Beg Coach Tabby Hitam").
3. **Rekod:** tab "Log" dalam sheet merekod setiap perubahan stok (masa, produk, +/-, sebab,
   sebelum → selepas, harga). Tool `betulkan` untuk batalkan entri silap dan maklumkan bos.
4. **Notifikasi bos:** setiap jualan dihantar satu-satu (jualan ~3 sehari).
5. **Antara muka:** bot Telegram (@BossGshirebot) berjalan 24 jam dalam komputer Windows.
   Hanya chat ID yang dibenarkan boleh guna. Auto-start melalui Task Scheduler.
   Perlu panduan langkah demi langkah untuk pengguna.
6. **Preorder:** iklan → deposit → beli → sampai (2–3 minggu) → pos. Tidak masuk lajur Stok.
   Tab "Preorder" dengan status Deposit → Dah beli → Dah sampai → Dah pos.
   Tiada booking atau pulangan buat masa ini.
7. **Duit:** tab Preorder ada Harga, Deposit, Baki. Tak boleh `Dah pos` selagi baki belum 0
   (kecuali disahkan). Peringatan harian: preorder > 3 minggu belum sampai, dan baki belum bayar.
   Harga jual direkod dalam Log.
8. **Promosi:** lajur "Harga Promosi" diisi oleh bos (clearance). Jika ada nilai, bot guna harga
   itu. Harga lain yang ditaip perlu disahkan.
9. **(Belum muktamad)** Lajur Stok dikunci (Protect range), hanya bot ubah. Kiraan stok fizikal
   melalui arahan "kira stok", direkod sebagai pelarasan. Kekerapan kiraan belum ditentukan.

## Status setup
- [x] Token bot Telegram dan chat ID dalam `.env` (komputer Windows), ujian notifikasi berjaya.
- [ ] ANTHROPIC_API_KEY
- [ ] Google Sheet + service account
- [ ] `pip install -r requirements.txt`
