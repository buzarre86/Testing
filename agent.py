"""AI agent pengurusan inventori.

Staf boleh taip arahan biasa (cth. "jual 2 beg coach", "stok masuk 10 jam casio",
"apa stok yang tinggal sikit?"). Setiap kali stok BERKURANG, bos akan dimaklumkan
secara automatik — ini dibuat dalam kod, bukan bergantung pada AI, supaya
notifikasi tidak pernah terlepas.
"""

import json
import os

import inventori
from notifikasi import maklum_bos

MODEL = os.environ.get("MODEL", "claude-sonnet-5-5")
MAKS_PUSINGAN = 10

SYSTEM_PROMPT = """Kamu ialah pembantu pengurusan inventori kedai. Jawab dalam Bahasa Melayu yang ringkas.

Peraturan:
- Guna tools untuk semak dan ubah stok. Jangan reka nombor stok.
- Bila staf jual / keluarkan / rosak / hilang barang, guna `kurang_stok` dan nyatakan sebab.
  Bos akan dimaklumkan secara automatik oleh sistem, jadi jangan panggil `maklum_bos` untuk pengurangan yang sama.
- Bila barang masuk / restock, guna `tambah_stok`.
- Jika nama produk tidak jelas atau tiada, semak `senarai_stok` dahulu, kemudian tanya staf jika masih tak pasti.
- Guna `maklum_bos` hanya bila staf minta hantar mesej lain kepada bos.
"""

TOOLS = [
    {
        "name": "senarai_stok",
        "description": "Senaraikan semua produk dalam inventori berserta stok semasa dan stok minimum.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "semak_stok",
        "description": "Semak stok semasa bagi satu produk.",
        "input_schema": {
            "type": "object",
            "properties": {"nama": {"type": "string", "description": "Nama produk"}},
            "required": ["nama"],
        },
    },
    {
        "name": "tambah_stok",
        "description": "Tambah stok (barang masuk/restock). Produk baru akan dicipta jika belum wujud.",
        "input_schema": {
            "type": "object",
            "properties": {
                "nama": {"type": "string"},
                "kuantiti": {"type": "integer", "minimum": 1},
                "stok_minimum": {
                    "type": "integer",
                    "description": "Pilihan: paras stok minimum sebelum amaran stok rendah.",
                },
            },
            "required": ["nama", "kuantiti"],
        },
    },
    {
        "name": "kurang_stok",
        "description": "Kurangkan stok (jualan, rosak, hilang, pulang ke pembekal). Bos dimaklumkan secara automatik.",
        "input_schema": {
            "type": "object",
            "properties": {
                "nama": {"type": "string"},
                "kuantiti": {"type": "integer", "minimum": 1},
                "sebab": {"type": "string", "description": "Cth: jualan, rosak, hilang"},
            },
            "required": ["nama", "kuantiti", "sebab"],
        },
    },
    {
        "name": "maklum_bos",
        "description": "Hantar mesej bebas kepada bos (selain notifikasi pengurangan stok automatik).",
        "input_schema": {
            "type": "object",
            "properties": {"subjek": {"type": "string"}, "mesej": {"type": "string"}},
            "required": ["subjek", "mesej"],
        },
    },
]


def proses_kurang_stok(nama, kuantiti, sebab):
    item, sebelum = inventori.kurang_stok(nama, kuantiti)
    rendah = item["stok"] <= item.get("stok_minimum", 0)
    subjek = f"{'⚠️ STOK RENDAH' if rendah else '📉 Stok berkurang'}: {item['nama']}"
    mesej = (
        f"Produk : {item['nama']}\n"
        f"Kurang : {kuantiti} unit ({sebab})\n"
        f"Stok   : {sebelum} → {item['stok']} unit\n"
        f"Minimum: {item.get('stok_minimum', 0)} unit"
    )
    if item["stok"] == 0:
        mesej += "\n\n❗ Stok sudah HABIS. Sila restock."
    elif rendah:
        mesej += "\n\nStok sudah mencecah paras minimum. Pertimbangkan restock."
    status = maklum_bos(subjek, mesej)
    return {"item": item, "stok_sebelum": sebelum, "stok_rendah": rendah, "notifikasi_bos": status}


def jalankan_tool(nama, inp):
    try:
        if nama == "senarai_stok":
            hasil = inventori.senarai_stok()
        elif nama == "semak_stok":
            hasil = inventori.semak_stok(inp["nama"])
        elif nama == "tambah_stok":
            hasil = inventori.tambah_stok(inp["nama"], inp["kuantiti"], inp.get("stok_minimum"))
        elif nama == "kurang_stok":
            hasil = proses_kurang_stok(inp["nama"], inp["kuantiti"], inp["sebab"])
        elif nama == "maklum_bos":
            hasil = maklum_bos(inp["subjek"], inp["mesej"])
        else:
            return f"Tool tidak dikenali: {nama}", True
        return json.dumps(hasil, ensure_ascii=False), False
    except inventori.RalatInventori as e:
        return str(e), True


def jawab(client, messages):
    """Jalankan gelung agent sampai model beri jawapan akhir."""
    for _ in range(MAKS_PUSINGAN):
        resp = client.messages.create(
            model=MODEL,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
        )
        messages.append({"role": "assistant", "content": resp.content})

        if resp.stop_reason != "tool_use":
            return "".join(b.text for b in resp.content if b.type == "text")

        hasil = []
        for block in resp.content:
            if block.type == "tool_use":
                output, ralat = jalankan_tool(block.name, block.input)
                hasil.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": output,
                    "is_error": ralat,
                })
        messages.append({"role": "user", "content": hasil})
    return "(Agent berhenti: terlalu banyak langkah. Cuba arahan yang lebih ringkas.)"


def muat_env(fail=".env"):
    if not os.path.exists(fail):
        return
    with open(fail, encoding="utf-8") as f:
        for baris in f:
            baris = baris.strip()
            if baris and not baris.startswith("#") and "=" in baris:
                k, v = baris.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def main():
    muat_env()
    import anthropic

    client = anthropic.Anthropic()
    messages = []
    print("🤖 Agent Inventori sedia. Taip arahan (atau 'keluar' untuk tamat).\n")
    while True:
        try:
            teks = input("Anda: ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if teks.lower() in {"keluar", "exit", "quit"}:
            break
        if not teks:
            continue
        messages.append({"role": "user", "content": teks})
        print(f"\nAgent: {jawab(client, messages)}\n")


if __name__ == "__main__":
    main()
