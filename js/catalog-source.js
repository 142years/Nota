if (typeof module !== 'undefined') Object.assign(globalThis, require('./config.js'), require('./helpers.js'));

// Katalog nota = data yang sama dengan web Cek Harga & Stok. Kunci di tabel app_data:
//   inventory:latest   barang + nomor seri (FIFO)
//   stockavail:latest  stok gudang sendiri dan cabang lain
//   rebornprice:latest harga retail per kode barang
//   barcode:latest     barcode per kode barang
const CATALOG_KEYS = ['inventory', 'stockavail', 'rebornprice', 'barcode'];

const STOCK_ORDER = { ready: 0, indent: 1, nonjual: 2, habis: 3 };
const STOCK_LABEL = { ready: 'Ready', indent: 'Indent', nonjual: 'Bukan stok jual', habis: 'Habis' };

function normCode(s) {
  return String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();
}

function barcodeList(v) {
  if (v === null || v === undefined) return [];
  const arr = Array.isArray(v) ? v : String(v).split(/[\s,;|]+/);
  const out = [];
  arr.forEach((x) => {
    const t = String(x).trim();
    if (t && !out.includes(t)) out.push(t);
  });
  return out;
}

function cleanQuery(s) {
  return String(s === null || s === undefined ? '' : s)
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, '')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function itemMeta(code, desc) {
  const parts = String(code || '').trim().toUpperCase().split('.');
  const m = {
    cat: parts[0] || '',
    brand: parts.length > 2 ? parts[1] : '',
    type: parts.length > 2 ? parts[2].replace(/\d+$/, '') : '',
  };
  const t = PRODUCT_TYPES.find((x) => x.test(m, desc || ''));
  m.jenis = t ? t.id : 'lainnya';
  return m;
}

const clone = (o) => (o === null || o === undefined ? o : JSON.parse(JSON.stringify(o)));
const isOwnWh = (wh) => STOCK_OWN_WAREHOUSES.includes(String(wh).trim().toUpperCase());
const isSpecialWh = (wh) => STOCK_SPECIAL_WAREHOUSES.includes(String(wh).trim().toUpperCase());

function mergeOthers(a, b) {
  if (!a && !b) return null;
  const merged = Object.assign({}, a || {}, b || {});
  return Object.keys(merged).length ? merged : null;
}

// Stock Available lama menyimpan gudang yang kini terdaftar sebagai gudang sendiri (mis. SDNX.STR)
// sebagai "cabang lain". Dipindahkan ke stok sendiri supaya statusnya READY, sama dengan web Cek Harga & Stok.
function normalizeStockAvail(sa) {
  const own = sa && sa.own ? clone(sa.own) : null;
  const map = sa && sa.map ? clone(sa.map) : {};
  const ownx = sa ? clone(sa.ownx || {}) : null;
  if (own !== null) {
    const addOwn = (code, wh, q) => {
      if (!(q > 0)) return;
      if (!own[code]) own[code] = { a: 0, l: 0 };
      own[code].a += q;
    };
    Object.keys(map).forEach((code) => {
      Object.keys(map[code]).forEach((wh) => {
        if (!isOwnWh(wh)) return;
        const q = Number(map[code][wh]) || 0;
        delete map[code][wh];
        addOwn(code, wh, q);
      });
      if (!Object.keys(map[code]).length) delete map[code];
    });
    if (ownx) {
      Object.keys(ownx).forEach((code) => {
        Object.keys(ownx[code]).forEach((wh) => {
          if (!isOwnWh(wh)) return;
          const q = Number(ownx[code][wh]) || 0;
          delete ownx[code][wh];
          addOwn(code, wh, q);
        });
        if (!Object.keys(ownx[code]).length) delete ownx[code];
      });
    }
  }
  return { own, map, ownx, desc: (sa && sa.descMap) || {} };
}

function stockState(p) {
  if (p.ready > 0) return 'ready';
  if (p.others) return 'indent';
  if (p.nonReady && Object.values(p.nonReady).some((q) => q > 0)) return 'nonjual';
  return 'habis';
}

function buildProducts(raw) {
  const inv = raw.inventory || null;
  const sa = normalizeStockAvail(raw.stockavail || null);
  const prices = (raw.rebornprice && raw.rebornprice.byCode) || {};
  const barcodes = (raw.barcode && raw.barcode.map) || {};
  const byBarcode = {};
  Object.keys(barcodes).forEach((k) => (byBarcode[normCode(k)] = barcodes[k]));

  const priceOf = (code) => {
    const p = Number(prices[normCode(code)]);
    return p > 0 ? p : null;
  };
  const make = (code, desc, fields) => {
    const m = itemMeta(code, desc);
    const units = (fields.ownUnits || [])
      .filter((u) => !u.fill && !isSpecialWh(u.whcode))
      .slice()
      .sort((a, b) => (a.status === 'Allocated') - (b.status === 'Allocated') || (a.ts || 0) - (b.ts || 0))
      .map((u) => ({ serial: u.serial, date: u.admissionDate || '', status: u.status || '' }));
    const bc = barcodeList(byBarcode[normCode(code)]);
    const p = {
      code,
      desc,
      price: priceOf(code),
      ready: fields.ready,
      others: fields.others,
      nonReady: fields.nonReady,
      units,
      barcodes: bc,
      jenis: m.jenis,
      brand: m.brand,
    };
    p.state = stockState(p);
    const allSerials = (fields.ownUnits || []).map((u) => u.serial).join(' ');
    p.hay = `${desc} ${code} ${allSerials} ${bc.join(' ')}`.toLowerCase();
    return p;
  };

  const products = [];
  const seen = new Set();
  ((inv && inv.items) || []).forEach((it) => {
    seen.add(it.code);
    const o = sa.own ? sa.own[it.code] : null;
    const base = it.snOthers !== undefined ? it.snOthers : it.others || null;
    const snOthers = base ? Object.fromEntries(Object.entries(base).filter(([wh]) => !isOwnWh(wh))) : null;
    products.push(
      make(it.code, it.desc || '(tanpa nama)', {
        ready: sa.own ? (o ? o.a + o.l : 0) : (it.available || 0) + (it.allocatedOwn || 0),
        others: mergeOthers(snOthers && Object.keys(snOthers).length ? snOthers : null, sa.map[it.code]),
        nonReady: sa.ownx ? sa.ownx[it.code] || null : it.ownNonReady || null,
        ownUnits: it.ownUnits,
      }),
    );
  });

  const extra = new Set(Object.keys(sa.map));
  if (sa.own) Object.keys(sa.own).forEach((c) => extra.add(c));
  if (sa.ownx) Object.keys(sa.ownx).forEach((c) => extra.add(c));
  extra.forEach((code) => {
    if (seen.has(code)) return;
    const o = sa.own ? sa.own[code] : null;
    const p = make(code, sa.desc[code] || '(tanpa nama)', {
      ready: o ? o.a + o.l : 0,
      others: sa.map[code] || null,
      nonReady: sa.ownx ? sa.ownx[code] || null : null,
      ownUnits: null,
    });
    // Barang yang hanya muncul dari Stock Available dan sudah tidak punya stok di mana pun tidak ditampilkan.
    if (p.state !== 'habis') products.push(p);
  });
  return products;
}

function scoreText(p, words) {
  const desc = p.desc.toLowerCase();
  const code = p.code.toLowerCase();
  let s = 0;
  words.forEach((w) => {
    if (code === w) s += 100;
    else if (code.startsWith(w)) s += 20;
    if (desc.startsWith(w)) s += 8;
    else if ((' ' + desc).includes(' ' + w)) s += 4;
    else if (desc.includes(w)) s += 2;
    else s += 1;
  });
  return s;
}

// opts: { jenis: id | '', onlyReady: bool }. Tanpa kata kunci dan tanpa filter jenis hasilnya kosong.
function searchProducts(products, rawQuery, opts) {
  opts = opts || {};
  const words = cleanQuery(rawQuery).toLowerCase().split(' ').filter(Boolean);
  if (!words.length && !opts.jenis) return [];
  const scored = [];
  for (const p of products) {
    if (opts.jenis && p.jenis !== opts.jenis) continue;
    if (opts.onlyReady && p.state !== 'ready') continue;
    if (words.length && !words.every((w) => p.hay.includes(w))) continue;
    scored.push({ p, s: words.length ? scoreText(p, words) : 0 });
  }
  const byPrice = (a, b) => (a === null ? (b === null ? 0 : 1) : b === null ? -1 : a - b);
  scored.sort(
    (x, y) =>
      STOCK_ORDER[x.p.state] - STOCK_ORDER[y.p.state] ||
      y.s - x.s ||
      byPrice(x.p.price, y.p.price) ||
      x.p.desc.localeCompare(y.p.desc),
  );
  return scored.map((x) => x.p);
}

// Jumlah per jenis mengikuti kata kunci (tapi mengabaikan filter jenis itu sendiri).
function jenisCounts(products, rawQuery, onlyReady) {
  const words = cleanQuery(rawQuery).toLowerCase().split(' ').filter(Boolean);
  const out = new Map();
  for (const p of products) {
    if (onlyReady && p.state !== 'ready') continue;
    if (words.length && !words.every((w) => p.hay.includes(w))) continue;
    out.set(p.jenis, (out.get(p.jenis) || 0) + 1);
  }
  return out;
}

const _exactCache = new WeakMap();
// Cocok persis dengan barcode, kode barang, atau SN: hasil scanner USB (yang menekan Enter) langsung masuk nota.
function findExact(products, rawQuery) {
  const q = cleanQuery(rawQuery);
  if (q.length < 4 || q.includes(' ')) return null;
  let idx = _exactCache.get(products);
  if (!idx) {
    idx = { barcode: new Map(), code: new Map(), serial: new Map() };
    products.forEach((p) => {
      idx.code.set(p.code.toUpperCase(), p);
      p.barcodes.forEach((b) => idx.barcode.set(b, p));
      p.units.forEach((u) => idx.serial.set(u.serial, { product: p, serial: u.serial }));
    });
    _exactCache.set(products, idx);
  }
  const bySerial = idx.serial.get(q);
  if (bySerial) return bySerial;
  const p = idx.barcode.get(q) || idx.code.get(q.toUpperCase());
  return p ? { product: p, serial: null } : null;
}

// fetchPayload(key) -> { ok, payload, message }. Satu key gagal tidak menggagalkan yang lain.
async function loadCatalogData(fetchPayload) {
  const errors = [];
  const raw = {};
  await Promise.all(
    CATALOG_KEYS.map(async (name) => {
      const r = await fetchPayload(name + ':latest');
      if (!r.ok) errors.push(`${name}: ${r.message}`);
      raw[name] = r.payload || null;
    }),
  );
  const products = buildProducts(raw);
  const sa = raw.stockavail;
  const updatedAt = (sa && sa.meta && sa.meta.updatedAt) || (raw.inventory && raw.inventory.updatedAt) || null;
  return {
    products,
    errors,
    meta: {
      updatedAt,
      count: products.length,
      noInventory: !raw.inventory,
      noPrices: !raw.rebornprice,
      noBarcodes: !raw.barcode,
    },
  };
}

// Pembaca nyata lewat supabase-js. Jaringan HP sering putus-nyambung, jadi dicoba sampai 3 kali.
function supabaseFetcher(client) {
  return async (key) => {
    let last = { ok: false, payload: null, message: 'gagal' };
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 500 * attempt));
      try {
        const { data, error } = await client.from('app_data').select('payload').eq('key', key).limit(1);
        if (error) {
          last = { ok: false, payload: null, message: error.message };
          continue;
        }
        return { ok: true, payload: data && data[0] ? data[0].payload : null, message: '' };
      } catch (e) {
        last = { ok: false, payload: null, message: e.message || String(e) };
      }
    }
    return last;
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    buildProducts,
    searchProducts,
    jenisCounts,
    findExact,
    loadCatalogData,
    stockState,
    normCode,
    cleanQuery,
    itemMeta,
    STOCK_LABEL,
  };
}
