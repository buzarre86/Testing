"""Pengurusan data inventori.

Sumber data:
- Google Sheets (utama): jika GOOGLE_SHEET_ID diisi dalam .env.
- Fail JSON (untuk cubaan/ujian): jika GOOGLE_SHEET_ID kosong.

Format Google Sheet (baris pertama ialah tajuk lajur, huruf besar/kecil tak penting):

    | Nama       | Stok | Stok Minimum | Dikemas Kini |
    | Beg Coach  | 5    | 2            |              |

Lajur "Stok Minimum" dan "Dikemas Kini" adalah pilihan.
"""

import json
import os
from datetime import datetime

LAJUR_NAMA = "nama"
LAJUR_STOK = "stok"
LAJUR_MIN = "stok minimum"
LAJUR_MASA = "dikemas kini"


class RalatInventori(Exception):
    pass


def _kunci(nama):
    return " ".join(nama.strip().lower().split())


def _nombor(nilai):
    try:
        return int(float(str(nilai).replace(",", "").strip() or 0))
    except ValueError:
        return 0


def _sekarang():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


# ---------------------------------------------------------------- Google Sheets
class SumberGoogleSheet:
    def __init__(self, sheet_id, nama_tab=None, fail_kelayakan="service_account.json"):
        import gspread

        gc = gspread.service_account(filename=fail_kelayakan)
        sh = gc.open_by_key(sheet_id)
        self.ws = sh.worksheet(nama_tab) if nama_tab else sh.sheet1

    def _lajur(self, tajuk):
        """Peta nama lajur -> nombor lajur (bermula 1)."""
        peta = {_kunci(t): i + 1 for i, t in enumerate(tajuk) if t.strip()}
        for wajib in (LAJUR_NAMA, LAJUR_STOK):
            if wajib not in peta:
                raise RalatInventori(
                    f"Lajur '{wajib.title()}' tiada dalam baris pertama Google Sheet. "
                    f"Tajuk sedia ada: {', '.join(tajuk)}"
                )
        return peta

    def semua(self):
        baris = self.ws.get_all_values()
        if not baris:
            raise RalatInventori("Google Sheet kosong. Baris pertama perlu ada tajuk 'Nama' dan 'Stok'.")
        lajur = self._lajur(baris[0])
        self._lajur_cache = lajur
        items = []
        for no, row in enumerate(baris[1:], start=2):
            def sel(k):
                c = lajur.get(k)
                return row[c - 1] if c and c - 1 < len(row) else ""

            if not sel(LAJUR_NAMA).strip():
                continue
            items.append({
                "nama": sel(LAJUR_NAMA).strip(),
                "stok": _nombor(sel(LAJUR_STOK)),
                "stok_minimum": _nombor(sel(LAJUR_MIN)),
                "_baris": no,
            })
        return items

    def simpan(self, item):
        lajur = self._lajur_cache
        masa = _sekarang()
        if "_baris" not in item:  # produk baru
            row = [""] * max(lajur.values())
            row[lajur[LAJUR_NAMA] - 1] = item["nama"]
            row[lajur[LAJUR_STOK] - 1] = item["stok"]
            if LAJUR_MIN in lajur:
                row[lajur[LAJUR_MIN] - 1] = item["stok_minimum"]
            if LAJUR_MASA in lajur:
                row[lajur[LAJUR_MASA] - 1] = masa
            self.ws.append_row(row, value_input_option="USER_ENTERED")
            return
        self.ws.update_cell(item["_baris"], lajur[LAJUR_STOK], item["stok"])
        if LAJUR_MIN in lajur:
            self.ws.update_cell(item["_baris"], lajur[LAJUR_MIN], item["stok_minimum"])
        if LAJUR_MASA in lajur:
            self.ws.update_cell(item["_baris"], lajur[LAJUR_MASA], masa)


# ---------------------------------------------------------------- Fail JSON
class SumberJSON:
    def __init__(self, fail):
        self.fail = fail

    def _muat(self):
        if not os.path.exists(self.fail):
            return {}
        with open(self.fail, encoding="utf-8") as f:
            return json.load(f)

    def semua(self):
        return [dict(v, stok_minimum=v.get("stok_minimum", 0)) for v in self._muat().values()]

    def simpan(self, item):
        data = self._muat()
        data[_kunci(item["nama"])] = {
            "nama": item["nama"],
            "stok": item["stok"],
            "stok_minimum": item["stok_minimum"],
            "dikemas_kini": _sekarang(),
        }
        with open(self.fail, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)


_sumber = None


def sumber():
    global _sumber
    if _sumber is None:
        sheet_id = os.environ.get("GOOGLE_SHEET_ID", "").strip()
        if sheet_id:
            _sumber = SumberGoogleSheet(
                sheet_id,
                os.environ.get("GOOGLE_SHEET_TAB") or None,
                os.environ.get("GOOGLE_CREDENTIALS", "service_account.json"),
            )
        else:
            _sumber = SumberJSON(os.environ.get("FAIL_INVENTORI", "inventori.json"))
    return _sumber


# ---------------------------------------------------------------- Operasi
def _awam(item):
    return {k: v for k, v in item.items() if not k.startswith("_")}


def _cari(items, nama):
    for item in items:
        if _kunci(item["nama"]) == _kunci(nama):
            return item
    senarai = ", ".join(i["nama"] for i in items) or "(kosong)"
    raise RalatInventori(f"Produk '{nama}' tiada dalam inventori. Produk sedia ada: {senarai}")


def senarai_stok():
    return [_awam(i) for i in sumber().semua()]


def semak_stok(nama):
    return _awam(_cari(sumber().semua(), nama))


def tambah_stok(nama, kuantiti, stok_minimum=None):
    if kuantiti <= 0:
        raise RalatInventori("Kuantiti mesti lebih daripada 0.")
    s = sumber()
    items = s.semua()
    try:
        item = _cari(items, nama)
    except RalatInventori:
        item = {"nama": nama.strip(), "stok": 0, "stok_minimum": 0}
    item["stok"] += kuantiti
    if stok_minimum is not None:
        item["stok_minimum"] = stok_minimum
    s.simpan(item)
    return _awam(item)


def kurang_stok(nama, kuantiti):
    """Kurangkan stok. Pulangkan (item, stok_sebelum)."""
    if kuantiti <= 0:
        raise RalatInventori("Kuantiti mesti lebih daripada 0.")
    s = sumber()
    item = _cari(s.semua(), nama)  # sentiasa baca nilai terkini sebelum tolak
    if item["stok"] < kuantiti:
        raise RalatInventori(
            f"Stok {item['nama']} tidak cukup: ada {item['stok']}, diminta {kuantiti}."
        )
    sebelum = item["stok"]
    item["stok"] -= kuantiti
    s.simpan(item)
    return _awam(item), sebelum
