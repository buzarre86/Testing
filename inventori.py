"""Pengurusan data inventori (disimpan dalam fail JSON)."""

import json
import os
from datetime import datetime

FAIL_INVENTORI = os.environ.get("FAIL_INVENTORI", "inventori.json")


class RalatInventori(Exception):
    pass


def _muat():
    if not os.path.exists(FAIL_INVENTORI):
        return {}
    with open(FAIL_INVENTORI, encoding="utf-8") as f:
        return json.load(f)


def _simpan(data):
    with open(FAIL_INVENTORI, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _kunci(nama):
    return nama.strip().lower()


def _cari(data, nama):
    item = data.get(_kunci(nama))
    if item is None:
        senarai = ", ".join(v["nama"] for v in data.values()) or "(kosong)"
        raise RalatInventori(f"Produk '{nama}' tiada dalam inventori. Produk sedia ada: {senarai}")
    return item


def senarai_stok():
    return list(_muat().values())


def semak_stok(nama):
    return _cari(_muat(), nama)


def tambah_stok(nama, kuantiti, stok_minimum=None):
    if kuantiti <= 0:
        raise RalatInventori("Kuantiti mesti lebih daripada 0.")
    data = _muat()
    item = data.get(_kunci(nama))
    if item is None:
        item = {"nama": nama.strip(), "stok": 0, "stok_minimum": 0}
        data[_kunci(nama)] = item
    item["stok"] += kuantiti
    if stok_minimum is not None:
        item["stok_minimum"] = stok_minimum
    item["dikemas_kini"] = datetime.now().isoformat(timespec="seconds")
    _simpan(data)
    return item


def kurang_stok(nama, kuantiti):
    """Kurangkan stok. Pulangkan (item, stok_sebelum)."""
    if kuantiti <= 0:
        raise RalatInventori("Kuantiti mesti lebih daripada 0.")
    data = _muat()
    item = _cari(data, nama)
    if item["stok"] < kuantiti:
        raise RalatInventori(
            f"Stok {item['nama']} tidak cukup: ada {item['stok']}, diminta {kuantiti}."
        )
    sebelum = item["stok"]
    item["stok"] -= kuantiti
    item["dikemas_kini"] = datetime.now().isoformat(timespec="seconds")
    _simpan(data)
    return item, sebelum
