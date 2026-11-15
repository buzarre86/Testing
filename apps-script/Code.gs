/**
 * 🤖 Pemerhati Stok → Telegram bos
 *
 * Skrip ini berjalan di dalam Google Sheet. Bos akan terima mesej Telegram bila:
 *   - nilai lajur stok ("Baki" / "Stok") TURUN, atau
 *   - nilai lajur "Status" BERTUKAR (cth. Ada → Terjual), atau
 *   - produk dipadam dari sheet,
 * sama ada staf ubah dengan tangan, atau program lain ubah melalui API.
 *
 * - Perubahan dengan tangan  → dikesan serta-merta (trigger onEdit)
 * - Perubahan oleh program   → dikesan dalam masa ~5 minit (trigger berjadual)
 *
 * Cara pasang: lihat apps-script/README.md
 */

// ===================== TETAPAN =====================
var NAMA_TAB = '';          // Nama tab stok. Kosongkan untuk guna tab pertama.
var SEMAK_SETIAP_MINIT = 5; // Mesti 1, 5, 10, 15 atau 30.

// Nama tajuk lajur yang diterima (huruf besar/kecil tak penting). Yang pertama dijumpai digunakan.
var LAJUR_KOD = ['kod', 'sku', 'kod produk'];           // pilihan, tapi disyorkan (pengenalan unik)
var LAJUR_NAMA = ['nama', 'nama produk', 'produk'];     // wajib
var LAJUR_STOK = ['baki', 'stok', 'kuantiti', 'qty'];   // wajib
var LAJUR_BRAND = ['brand', 'jenama'];                  // pilihan, dipaparkan dalam mesej
var LAJUR_STATUS = ['status'];                          // pilihan: bos dimaklumkan bila status bertukar
var AWALAN_SNAPSHOT = 'stok:';
// ===================================================


/** Menu tambahan dalam Google Sheet. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🤖 Inventori')
    .addItem('1. Masukkan token bot Telegram', 'tetapkanToken')
    .addItem('2. Cari chat ID bos', 'cariChatIdBos')
    .addItem('3. Hantar mesej ujian', 'hantarMesejUjian')
    .addItem('4. Hidupkan pemerhati stok', 'hidupkanPemerhati')
    .addSeparator()
    .addItem('Matikan pemerhati stok', 'matikanPemerhati')
    .addToUi();
}


// ===================== PENYEDIAAN =====================

function tetapkanToken() {
  var ui = SpreadsheetApp.getUi();
  var jawapan = ui.prompt('Token bot Telegram',
    'Tampal token yang diberi oleh @BotFather (cth. 123456:ABC-xyz...)', ui.ButtonSet.OK_CANCEL);
  if (jawapan.getSelectedButton() !== ui.Button.OK) return;
  var token = jawapan.getResponseText().trim();
  if (!/^\d+:[\w-]+$/.test(token)) {
    ui.alert('Format token tidak betul. Sila salin semula dari @BotFather.');
    return;
  }
  PropertiesService.getScriptProperties().setProperty('TELEGRAM_BOT_TOKEN', token);
  ui.alert('✅ Token disimpan.\n\nSeterusnya: minta bos buka bot anda di Telegram dan tekan START, ' +
    'kemudian pilih menu "2. Cari chat ID bos".');
}

function cariChatIdBos() {
  var ui = SpreadsheetApp.getUi();
  var token = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
  if (!token) { ui.alert('Sila buat langkah 1 (masukkan token) dahulu.'); return; }

  var resp = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getUpdates',
    { muteHttpExceptions: true });
  var data = JSON.parse(resp.getContentText());
  if (!data.ok) { ui.alert('Telegram menolak token: ' + (data.description || resp.getResponseCode())); return; }

  var dijumpai = {};
  (data.result || []).forEach(function (u) {
    var m = u.message || u.my_chat_member || {};
    var c = m.chat;
    if (c && c.type === 'private') {
      dijumpai[c.id] = [c.first_name, c.last_name].filter(Boolean).join(' ') +
        (c.username ? ' (@' + c.username + ')' : '');
    }
  });
  var ids = Object.keys(dijumpai);
  if (ids.length === 0) {
    ui.alert('Belum ada sesiapa tekan START pada bot.\n\nMinta bos buka bot anda di Telegram, ' +
      'tekan START (atau hantar "hai"), kemudian cuba menu ini sekali lagi.');
    return;
  }

  for (var i = 0; i < ids.length; i++) {
    var b = ui.alert('Adakah ini bos?', dijumpai[ids[i]] + '\nChat ID: ' + ids[i], ui.ButtonSet.YES_NO);
    if (b === ui.Button.YES) {
      PropertiesService.getScriptProperties().setProperty('TELEGRAM_CHAT_ID', String(ids[i]));
      ui.alert('✅ Chat ID bos disimpan. Seterusnya: pilih "3. Hantar mesej ujian".');
      return;
    }
  }
  ui.alert('Tiada yang dipilih. Pastikan bos sudah tekan START, kemudian cuba lagi.');
}

function hantarMesejUjian() {
  var ok = hantarTelegram_('✅ Ujian: Pemerhati stok "' +
    SpreadsheetApp.getActiveSpreadsheet().getName() + '" sudah disambungkan ke Telegram anda.');
  SpreadsheetApp.getUi().alert(ok ? '✅ Mesej ujian dihantar. Minta bos semak Telegram.'
    : '❌ Gagal hantar. Semak token dan chat ID (langkah 1 & 2).');
}

function hidupkanPemerhati() {
  var ui = SpreadsheetApp.getUi();
  var p = PropertiesService.getScriptProperties();
  if (!p.getProperty('TELEGRAM_BOT_TOKEN') || !p.getProperty('TELEGRAM_CHAT_ID')) {
    ui.alert('Sila lengkapkan langkah 1 dan 2 dahulu.');
    return;
  }
  var items;
  try {
    items = bacaStok_();
  } catch (err) {
    ui.alert('❌ ' + err.message);
    return;
  }
  padamTrigger_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.newTrigger('bilaDiubah').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('semakBerjadual').timeBased().everyMinutes(SEMAK_SETIAP_MINIT).create();

  // Rekod stok semasa sebagai titik permulaan (tiada notifikasi untuk nilai sedia ada).
  simpanSnapshot_(items, true);
  ui.alert('✅ Pemerhati stok sudah HIDUP.\n\n' + items.length + ' produk sedang diperhati. ' +
    'Bos akan dimaklumkan setiap kali stok berkurang.');
}

function matikanPemerhati() {
  padamTrigger_();
  SpreadsheetApp.getUi().alert('Pemerhati stok sudah DIMATIKAN. Bos tidak akan terima notifikasi lagi.');
}

function padamTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var f = t.getHandlerFunction();
    if (f === 'bilaDiubah' || f === 'semakBerjadual') ScriptApp.deleteTrigger(t);
  });
}


// ===================== PEMERHATI =====================

/** Dipanggil serta-merta bila seseorang ubah sheet dengan tangan. */
function bilaDiubah(e) {
  var tab = dapatkanTab_();
  if (e && e.range && e.range.getSheet().getSheetId() !== tab.getSheetId()) return;
  var pengubah = '';
  try { pengubah = (e && e.user && e.user.getEmail()) || ''; } catch (err) { /* tiada akses */ }
  semakPerubahan_(pengubah);
}

/** Dipanggil setiap beberapa minit: kesan perubahan oleh program/API. */
function semakBerjadual() {
  semakPerubahan_('');
}

function semakPerubahan_(pengubah) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return; // semakan lain sedang berjalan; ia akan tangkap perubahan ini
  try {
    var items = bacaStok_();
    var perubahan = kiraPerubahan(muatSnapshot_(), items);
    if (perubahan.length > 0) {
      var mesej = binaMesej(perubahan, pengubah, SpreadsheetApp.getActiveSpreadsheet().getName());
      if (!hantarTelegram_(mesej)) {
        return; // jangan kemas kini snapshot supaya dicuba semula pada semakan seterusnya
      }
    }
    simpanSnapshot_(items, false);
  } finally {
    lock.releaseLock();
  }
}


// ===================== LOGIK (tiada kebergantungan Google, mudah diuji) =====================

function kunci_(s) {
  return String(s).trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Tukar nilai sel kepada nombor. Pulangkan null jika kosong/bukan nombor. */
function nombor_(v) {
  if (typeof v === 'number') return v;
  var s = String(v).replace(/,/g, '').trim();
  if (s === '' || isNaN(Number(s))) return null;
  return Number(s);
}

function samaStatus_(a, b) {
  return kunci_(a) === kunci_(b);
}

/**
 * Bandingkan snapshot lama dengan data semasa.
 * @param {Object} lama   {kunci: {s: stok, t: status, n: nama}}  (t undefined = belum direkod)
 * @param {Array}  items  [{kunci, nama, stok, status}]  (stok null = sel kosong; status null = tiada lajur)
 * @return {Array} senarai perubahan yang perlu dimaklumkan
 */
function kiraPerubahan(lama, items) {
  var hasil = [];
  var ada = {};
  items.forEach(function (it) {
    var k = it.kunci;
    ada[k] = true;
    var l = lama[k];
    if (!l) return; // produk baru: abaikan
    var stokTurun = it.stok !== null && l.s !== null && l.s !== undefined && it.stok < l.s;
    var statusBerubah = it.status !== null && l.t !== null && l.t !== undefined &&
      !samaStatus_(it.status, l.t);
    if (stokTurun || statusBerubah) {
      hasil.push({
        nama: it.nama,
        stokTurun: stokTurun, sebelum: l.s, selepas: it.stok,
        statusBerubah: statusBerubah, statusLama: l.t, statusBaru: it.status
      });
    }
  });
  Object.keys(lama).forEach(function (k) {
    if (!ada[k]) hasil.push({ nama: lama[k].n || k, sebelum: lama[k].s, dipadam: true });
  });
  return hasil;
}

function paparStatus_(s) {
  return String(s).trim() || '(kosong)';
}

function binaMesej(perubahan, pengubah, namaSheet) {
  var bahagian = perubahan.map(function (p) {
    if (p.dipadam) {
      return '🗑️ ' + p.nama + '\nProduk DIPADAM dari sheet' +
        (p.sebelum !== null && p.sebelum !== undefined ? ' (baki terakhir: ' + p.sebelum + ' unit)' : '');
    }
    var baris;
    if (p.stokTurun) {
      baris = (p.selepas <= 0 ? '❗ HABIS' : '📉 Stok berkurang') + ': ' + p.nama +
        '\nKurang : ' + (p.sebelum - p.selepas) + ' unit' +
        '\nBaki   : ' + p.sebelum + ' → ' + p.selepas + ' unit';
    } else {
      baris = '🔄 Status bertukar: ' + p.nama;
      if (p.selepas !== null) baris += '\nBaki   : ' + p.selepas + ' unit';
    }
    if (p.statusBerubah) {
      baris += '\nStatus : ' + paparStatus_(p.statusLama) + ' → ' + paparStatus_(p.statusBaru);
    }
    if (p.stokTurun && p.selepas <= 0) baris += '\nSila restock segera.';
    return baris;
  });
  var kepala = '📦 ' + namaSheet;
  if (pengubah) kepala += '\nDiubah oleh: ' + pengubah;
  var teks = kepala + '\n\n' + bahagian.join('\n\n');
  return teks.length > 4000 ? teks.slice(0, 3990) + '\n…' : teks; // had Telegram 4096 aksara
}


// ===================== GOOGLE SHEET & TELEGRAM =====================

function dapatkanTab_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tab = NAMA_TAB ? ss.getSheetByName(NAMA_TAB) : ss.getSheets()[0];
  if (!tab) throw new Error('Tab "' + NAMA_TAB + '" tidak dijumpai.');
  return tab;
}

function cariLajur_(tajuk, pilihan) {
  for (var i = 0; i < pilihan.length; i++) {
    var c = tajuk.indexOf(pilihan[i]);
    if (c >= 0) return c;
  }
  return -1;
}

function bacaStok_() {
  var nilai = dapatkanTab_().getDataRange().getValues();
  if (nilai.length === 0) return [];
  var tajuk = nilai[0].map(kunci_);
  var cK = cariLajur_(tajuk, LAJUR_KOD), cN = cariLajur_(tajuk, LAJUR_NAMA),
      cS = cariLajur_(tajuk, LAJUR_STOK), cB = cariLajur_(tajuk, LAJUR_BRAND),
      cT = cariLajur_(tajuk, LAJUR_STATUS);
  if (cN < 0 || cS < 0) {
    throw new Error('Baris pertama mesti ada lajur nama produk (' + LAJUR_NAMA.join('/') +
      ') dan stok (' + LAJUR_STOK.join('/') + '). Tajuk sekarang: ' + nilai[0].join(', '));
  }
  var items = [], dilihat = {};
  for (var r = 1; r < nilai.length; r++) {
    var row = nilai[r];
    var nama = String(row[cN]).trim();
    var kod = cK >= 0 ? String(row[cK]).trim() : '';
    if (!nama && !kod) continue;
    var brand = cB >= 0 ? String(row[cB]).trim() : '';
    var label = (brand && nama.toLowerCase().indexOf(brand.toLowerCase()) < 0 ? brand + ' ' : '') + nama;
    if (kod) label += ' [' + kod + ']';
    var k = kunci_(kod || nama);
    dilihat[k] = (dilihat[k] || 0) + 1;
    if (dilihat[k] > 1) k += '#' + dilihat[k]; // kod/nama berulang
    items.push({
      kunci: k,
      nama: label,
      stok: nombor_(row[cS]),
      status: cT >= 0 ? String(row[cT]).trim() : null
    });
  }
  return items;
}

/** Pulangkan {kunci: {s: stok, t: status, n: nama}} */
function muatSnapshot_() {
  var semua = PropertiesService.getScriptProperties().getProperties();
  var snap = {};
  Object.keys(semua).forEach(function (k) {
    if (k.indexOf(AWALAN_SNAPSHOT) !== 0) return;
    var kk = k.slice(AWALAN_SNAPSHOT.length);
    var v = String(semua[k]);
    if (v.charAt(0) === '{') {
      snap[kk] = JSON.parse(v);
    } else { // format lama: "stok|Nama"
      var i = v.indexOf('|');
      snap[kk] = { s: Number(i < 0 ? v : v.slice(0, i)), n: i < 0 ? kk : v.slice(i + 1) };
    }
  });
  return snap;
}

function simpanSnapshot_(items, mulaSemula) {
  var p = PropertiesService.getScriptProperties();
  var lama = muatSnapshot_();
  var baru = {};
  items.forEach(function (it) {
    var l = lama[it.kunci] || {};
    var stok = it.stok !== null ? it.stok : (!mulaSemula && l.s !== undefined ? l.s : null); // sel kosong: kekalkan nilai lama
    baru[AWALAN_SNAPSHOT + it.kunci] = JSON.stringify({ s: stok, t: it.status, n: it.nama });
  });
  Object.keys(lama).forEach(function (k) {
    if (!((AWALAN_SNAPSHOT + k) in baru)) p.deleteProperty(AWALAN_SNAPSHOT + k);
  });
  p.setProperties(baru, false);
}

function hantarTelegram_(teks) {
  var p = PropertiesService.getScriptProperties();
  var token = p.getProperty('TELEGRAM_BOT_TOKEN');
  var chatId = p.getProperty('TELEGRAM_CHAT_ID');
  if (!token || !chatId) { console.warn('Telegram belum disediakan.'); return false; }
  var resp = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'post',
    payload: { chat_id: chatId, text: teks },
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200) {
    console.error('Telegram gagal: ' + resp.getContentText());
    return false;
  }
  return true;
}
