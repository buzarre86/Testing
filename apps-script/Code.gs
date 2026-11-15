/**
 * 🤖 Pemerhati Stok → Telegram bos
 *
 * Skrip ini berjalan di dalam Google Sheet. Setiap kali nilai lajur "Stok"
 * TURUN (sama ada staf ubah dengan tangan, atau program lain ubah melalui API),
 * bos akan terima mesej Telegram.
 *
 * - Perubahan dengan tangan  → dikesan serta-merta (trigger onEdit)
 * - Perubahan oleh program   → dikesan dalam masa ~5 minit (trigger berjadual)
 *
 * Cara pasang: lihat apps-script/README.md
 */

// ===================== TETAPAN =====================
var NAMA_TAB = '';          // Nama tab stok. Kosongkan untuk guna tab pertama.
var SEMAK_SETIAP_MINIT = 5; // Mesti 1, 5, 10, 15 atau 30.

var LAJUR_NAMA = 'nama';
var LAJUR_STOK = 'stok';
var LAJUR_MIN = 'stok minimum';
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
  padamTrigger_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.newTrigger('bilaDiubah').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('semakBerjadual').timeBased().everyMinutes(SEMAK_SETIAP_MINIT).create();

  // Rekod stok semasa sebagai titik permulaan (tiada notifikasi untuk nilai sedia ada).
  var items = bacaStok_();
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
    var snap = muatSnapshot_();
    var perubahan = kiraPengurangan(snap.stok, items, snap.nama);
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

/**
 * Bandingkan snapshot lama dengan stok semasa.
 * @param {Object} sebelum   {kunci: stok}
 * @param {Array}  items     [{nama, stok, min}]  (stok null = sel kosong/tidak sah)
 * @param {Object} namaLama  {kunci: nama asal}  (pilihan, untuk produk dipadam)
 * @return {Array} senarai pengurangan
 */
function kiraPengurangan(sebelum, items, namaLama) {
  namaLama = namaLama || {};
  var hasil = [];
  var ada = {};
  items.forEach(function (it) {
    var k = kunci_(it.nama);
    ada[k] = true;
    if (it.stok === null || !(k in sebelum)) return; // produk baru atau sel kosong: abaikan
    if (it.stok < sebelum[k]) {
      hasil.push({ nama: it.nama, sebelum: sebelum[k], selepas: it.stok, min: it.min });
    }
  });
  Object.keys(sebelum).forEach(function (k) {
    if (!ada[k]) hasil.push({ nama: namaLama[k] || k, sebelum: sebelum[k], selepas: null, min: 0, dipadam: true });
  });
  return hasil;
}

function binaMesej(perubahan, pengubah, namaSheet) {
  var bahagian = perubahan.map(function (p) {
    if (p.dipadam) {
      return '🗑️ ' + p.nama + '\nProduk DIPADAM dari sheet (stok terakhir: ' + p.sebelum + ' unit)';
    }
    var kurang = p.sebelum - p.selepas;
    var tajuk = p.selepas <= 0 ? '❗ HABIS' : (p.selepas <= p.min ? '⚠️ STOK RENDAH' : '📉 Stok berkurang');
    var baris = tajuk + ': ' + p.nama +
      '\nKurang : ' + kurang + ' unit' +
      '\nStok   : ' + p.sebelum + ' → ' + p.selepas + ' unit';
    if (p.min) baris += '\nMinimum: ' + p.min + ' unit';
    if (p.selepas <= 0) baris += '\nSila restock segera.';
    else if (p.selepas <= p.min) baris += '\nPertimbangkan restock.';
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

function bacaStok_() {
  var nilai = dapatkanTab_().getDataRange().getValues();
  if (nilai.length === 0) return [];
  var tajuk = nilai[0].map(kunci_);
  var cN = tajuk.indexOf(LAJUR_NAMA), cS = tajuk.indexOf(LAJUR_STOK), cM = tajuk.indexOf(LAJUR_MIN);
  if (cN < 0 || cS < 0) {
    throw new Error('Baris pertama mesti ada lajur "Nama" dan "Stok". Tajuk sekarang: ' + nilai[0].join(', '));
  }
  var items = [];
  for (var r = 1; r < nilai.length; r++) {
    var nama = String(nilai[r][cN]).trim();
    if (!nama) continue;
    items.push({
      nama: nama,
      stok: nombor_(nilai[r][cS]),
      min: cM >= 0 ? (nombor_(nilai[r][cM]) || 0) : 0
    });
  }
  return items;
}

function muatSnapshot_() {
  var semua = PropertiesService.getScriptProperties().getProperties();
  var snap = { stok: {}, nama: {} };
  Object.keys(semua).forEach(function (k) {
    if (k.indexOf(AWALAN_SNAPSHOT) !== 0) return;
    var kk = k.slice(AWALAN_SNAPSHOT.length);
    var v = String(semua[k]), i = v.indexOf('|'); // format: "stok|Nama Asal"
    snap.stok[kk] = Number(i < 0 ? v : v.slice(0, i));
    snap.nama[kk] = i < 0 ? kk : v.slice(i + 1);
  });
  return snap;
}

function simpanSnapshot_(items, mulaSemula) {
  var p = PropertiesService.getScriptProperties();
  var lama = muatSnapshot_().stok;
  var baru = {};
  items.forEach(function (it) {
    var k = kunci_(it.nama);
    var stok = it.stok !== null ? it.stok : (!mulaSemula && k in lama ? lama[k] : null); // sel kosong: kekalkan nilai lama
    if (stok !== null) baru[AWALAN_SNAPSHOT + k] = stok + '|' + it.nama;
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
