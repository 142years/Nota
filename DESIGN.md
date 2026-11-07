# Arah desain 142Nota

Sumber: ekspor Stitch "U" (3 layar: Buat Nota, Riwayat Nota, Manajemen Sales), dipakai sebagai arah dari pemilik.

Reading this as: alat kasir internal untuk staf toko Gadgetmart, bahasa visual monokrom Stitch (hitam di atas putih gading), dial ENERGY 1 / RHYTHM 2 / MOTION 1.

## Palet
- Dasar: `#F8F9FA` (halaman), `#FFFFFF` (kartu dan kertas nota), `#191C1D` (teks)
- Aksen tunggal: hitam `#000000`, hanya untuk aksi utama (Cetak, Tambah sales) dan tab aktif
- Warna status hanya untuk stok dan status nota (hijau ready, kuning indent, merah habis/batal). Tidak ada warna dekoratif.

## Tipografi
- Hanken Grotesk untuk antarmuka.
- JetBrains Mono khusus kode barang, SN, nomor nota, dan angka rupiah: kolomnya harus sejajar dan SN 15 digit perlu mudah dibaca.

## Bentuk
- Radius 2px untuk kontrol, 8px untuk kartu. Tanpa pil, tanpa blur, tanpa glow.
- Bayangan hanya untuk kertas nota dan dialog (keduanya memang terangkat dari halaman).

## Tema
Terang saja. Objek utama halaman adalah kertas nota putih, dan arah Stitch dari pemilik hanya terang.

## Motif identitas
Kertas nota 80 mm berujung bergerigi, dipakai di pratinjau dan dialog riwayat.

## Yang dibuang dari ekspor Stitch
Titik hijau berdenyut, lencana "MODA TRANSAKSI AKTIF", label huruf besar ber-tracking lebar, emoji di pilihan pembayaran, kotak logo ikon, dan semua angka/nama contoh (Ahmad Fauzi, 14 staf, Rp 64.820.000, dst). Semua angka di aplikasi dihitung dari data nyata.
