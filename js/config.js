// Sumber katalog: tabel app_data di Supabase yang sama dengan web Cek Harga & Stok (hanya dibaca).
// URL dan anon key sama persis dengan Stok-Gudang-SDNC/js/config.js.
const SUPABASE_URL = 'https://mzgieucddbplyjsbklep.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16Z2lldWNkZGJwbHlqc2JrbGVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNzA4OTQsImV4cCI6MjEwNTY0Njg5NH0.Gw4UWJLaIr7_FPaJbbpXoSW9jQBfB4mAG1aMZ5BKFyo';

// Tempat nota dan daftar sales disimpan.
//   'local'    = di browser perangkat ini (jalan tanpa setup, tidak ikut pindah perangkat)
//   'supabase' = tabel nota dan sales_users (jalankan supabase/schema.sql dulu)
const STORE_BACKEND = 'local';

// Kop nota. Teks diambil dari desain Stitch; sesuaikan bila ada yang berbeda dengan nota SAP.
const COMPANY = {
  brand: 'GADGETMART',
  legalName: 'PT. SINAR JAYA SELULER',
  phone: '6282254919466',
  address: 'JL.BELITUNG LAUT RT 005 RW 001',
  npwp: '10.951.343.2-731.000',
  footerNote: 'Mohon periksa kembali & pastikan barang yang anda beli dalam keadaan mulus & lengkap',
  taxNote: 'Harga diatas sudah termasuk pajak',
};

const PAYMENT_METHODS = [
  { id: 'tunai', label: 'Cash / Tunai', cash: true },
  { id: 'qris', label: 'QRIS BCA' },
  { id: 'debit', label: 'Debit BCA / EDC' },
  { id: 'transfer', label: 'Transfer Bank' },
];

// Samakan dengan Stok-Gudang-SDNC/js/stock-config.js. Gudang sendiri dihitung sebagai stok ready.
const STOCK_OWN_WAREHOUSES = ['SDNC.UTM', 'SDNC.SHO', 'SDNX.SHO', 'SDNX.STR', 'SDNC.RUS', 'SDNC.DEM', 'SDNC.KEP'];
// Gudang rusak/demo/keep ikut dihitung sebagai stok, tapi SN-nya tidak ditawarkan saat jual.
const STOCK_SPECIAL_WAREHOUSES = ['SDNC.RUS', 'SDNC.DEM', 'SDNC.KEP'];

// Jenis barang dibaca dari kode KATEGORI.BRAND.JENISnomor. Samakan dengan Stok-Gudang-SDNC/js/filter-config.js.
const TABLET_RE = /\b(X?TAB|TABLET)\b|PAD\b/i;
const PRODUCT_TYPES = [
  { id: 'hp', label: 'HP', test: (m, d) => m.cat === 'GAD' && m.type === 'HP' && !TABLET_RE.test(d) },
  { id: 'tablet', label: 'Tablet', test: (m, d) => m.cat === 'GAD' && m.type === 'HP' && TABLET_RE.test(d) },
  { id: 'laptop', label: 'Laptop & PC', test: (m) => m.cat === 'GAD' && (m.type === 'NB' || m.type === 'PC') },
  { id: 'jam', label: 'Jam / Wearable', test: (m) => m.cat === 'GAD' && m.type === 'JAM' },
  { id: 'gadlain', label: 'Gadget lain', test: (m) => m.cat === 'GAD' },
  { id: 'aksesoris', label: 'Aksesoris', test: (m) => m.cat === 'ACC' },
  { id: 'sparepart', label: 'Sparepart', test: (m) => m.cat === 'FIX' },
];

const CATALOG_RESULT_LIMIT = 40;

if (typeof module !== 'undefined') {
  module.exports = { COMPANY, PAYMENT_METHODS, STOCK_OWN_WAREHOUSES, STOCK_SPECIAL_WAREHOUSES, PRODUCT_TYPES, CATALOG_RESULT_LIMIT };
}
