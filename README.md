# 142Nota

Pembuat nota kasir Gadgetmart. Katalog barang, harga, stok, dan SN dibaca dari Supabase yang sama dengan web [Cek Harga & Stok](https://github.com/142years/Stok-Gudang-SDNC) (hanya baca, tidak mengubah data di sana).

Web statis tanpa build: buka `index.html` atau pasang di GitHub Pages.

- Pengaturan kop nota, metode bayar, dan gudang: `js/config.js`
- Nota dan sales disimpan di browser (`STORE_BACKEND = 'local'`). Untuk dipakai bersama banyak perangkat, jalankan `supabase/schema.sql` lalu ubah menjadi `'supabase'`.
- Arah desain: `DESIGN.md`
- Uji: `node --test tests/unit.test.cjs`, dan `node tests/e2e.mjs` (butuh Playwright + Chromium)
