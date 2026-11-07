const test = require('node:test');
const assert = require('node:assert/strict');
const cat = require('../js/catalog-source.js');
const model = require('../js/nota-model.js');
const rcpt = require('../js/receipt.js');
const store = require('../js/store.js');

const raw = require('./fixture.cjs');
const products = cat.buildProducts(raw);
const by = (c) => products.find((p) => p.code === c);

test('stok gudang sendiri baru (SDNX.STR) dipindah dari cabang lain ke ready', () => {
  const a = by('ACC.ANK.CH00001');
  assert.equal(a.ready, 5);
  assert.equal(a.state, 'ready');
  assert.deepEqual(a.others, { 'BJM.A': 3 });
});
test('ready = available + allocated, harga dari reborn, tanpa harga = null', () => {
  assert.equal(by('GAD.OPO.HP00123').ready, 4);
  assert.equal(by('GAD.OPO.HP00123').price, 7999000);
  assert.equal(by('GAD.SAM.HP00999').price, null);
});
test('status stok: indent, nonjual, habis', () => {
  assert.equal(by('GAD.SAM.HP00999').state, 'indent');
  assert.equal(by('ACC.XXX.GL00001').state, 'nonjual');
});
test('SN: gudang khusus dibuang, FIFO, Allocated terakhir', () => {
  assert.deepEqual(by('GAD.OPO.HP00123').units.map((u) => u.serial), ['333333333333333333333333', '222222222222222222222222', '111111111111111111111111']);
});
test('barang hanya dari Stock Available: masuk bila ada stok, dibuang bila kosong', () => {
  assert.ok(by('GAD.NEW.HP00777'));
  assert.equal(by('GAD.NEW.HP00777').state, 'indent');
  assert.equal(by('GAD.GONE.HP00001'), undefined);
});
test('jenis: tablet dibedakan dari HP', () => {
  assert.equal(by('GAD.OPO.HP00123').jenis, 'hp');
  assert.equal(by('GAD.SAM.HP00999').jenis, 'tablet');
  assert.equal(by('ACC.ANK.CH00001').jenis, 'aksesoris');
});
test('cari: kata kunci AND, urut ready dulu, filter jenis & ready', () => {
  assert.deepEqual(cat.searchProducts(products, 'oppo a7').map((p) => p.code), ['GAD.OPO.HP00123']);
  assert.deepEqual(cat.searchProducts(products, '', {}), []);
  assert.equal(cat.searchProducts(products, '', { jenis: 'aksesoris' }).length, 2);
  assert.ok(cat.searchProducts(products, 'galaxy', { onlyReady: true }).length === 0);
  const all = cat.searchProducts(products, '', { jenis: 'aksesoris' });
  assert.equal(all[0].state, 'ready');
  assert.ok(cat.searchProducts(products, '222222222222222222222222').some((p) => p.code === 'GAD.OPO.HP00123'), 'cari lewat SN');
});
test('exact: barcode, SN, kode; spasi pada barcode sel dipecah', () => {
  assert.equal(cat.findExact(products, '8801234567890').product.code, 'GAD.OPO.HP00123');
  assert.equal(cat.findExact(products, '222222222222222222222222').serial, null === 0 ? 1 : cat.findExact(products, '222222222222222222222222') && '222222222222222222222222');
  assert.equal(cat.findExact(products, 'gad.opo.hp00123').product.code, 'GAD.OPO.HP00123');
  assert.equal(cat.findExact(products, '222333').product.code, 'ACC.ANK.CH00001');
  assert.equal(cat.findExact(products, '111222'), null);
  assert.equal(cat.findExact(products, 'tidak ada'), null);
});
test('loadCatalogData: satu key gagal tidak menggagalkan lainnya', async () => {
  const r = await cat.loadCatalogData(async (key) => {
    const name = key.split(':')[0];
    return name === 'barcode' ? { ok: false, payload: null, message: 'timeout' } : { ok: true, payload: raw[name] };
  });
  assert.equal(r.errors.length, 1);
  assert.ok(r.errors[0].startsWith('barcode'));
  assert.ok(r.products.length > 0);
  assert.equal(r.meta.updatedAt, '2026-11-06T01:00:00Z');
});

test('total, diskon dibatasi, kembalian dan kurang (tunai)', () => {
  const n = model.newNota();
  model.addCustomLine(n, 'TAS', 1, 0);
  model.addCustomLine(n, 'BARANG', 2, 150000);
  n.discount = 999999999;
  assert.equal(model.totals(n).discount, 300000);
  n.discount = 50000;
  n.paid = 300000;
  let t = model.totals(n);
  assert.deepEqual([t.subtotal, t.total, t.change, t.short], [300000, 250000, 50000, 0]);
  n.paid = 100000;
  t = model.totals(n);
  assert.equal(t.short, 150000);
  n.payment = 'qris';
  t = model.totals(n);
  assert.deepEqual([t.paid, t.short, t.isCash], [250000, 0, false]);
});
test('HP: satu baris per unit dengan SN FIFO; aksesoris digabung', () => {
  const n = model.newNota();
  const hp = by('GAD.OPO.HP00123');
  model.addProductLine(n, hp);
  model.addProductLine(n, hp);
  assert.deepEqual(n.lines.map((l) => l.sn), ['333333333333333333333333', '222222222222222222222222']);
  model.addProductLine(n, hp, '111111111111111111111111');
  assert.equal(n.lines[2].sn, '111111111111111111111111');
  model.addProductLine(n, hp);
  assert.equal(n.lines[3].sn, '', 'SN habis -> kosong');
  const acc = by('ACC.ANK.CH00001');
  model.addProductLine(n, acc);
  model.addProductLine(n, acc);
  assert.equal(n.lines.filter((l) => l.code === acc.code).length, 1);
  assert.equal(n.lines.find((l) => l.code === acc.code).qty, 2);
});
test('nomor nota: YYMMDD + urutan per hari', () => {
  const d = new Date(2026, 10, 7, 10, 0);
  assert.equal(model.nextNotaNo([], d), '261107001');
  assert.equal(model.nextNotaNo(['261107001', '261107009', '261106050'], d), '261107010');
});
test('validasi cetak', () => {
  const n = model.newNota();
  assert.ok(model.validateForPrint(n).length >= 2);
  model.addProductLine(n, by('GAD.OPO.HP00123'));
  n.salesCode = 'FL.1';
  n.paid = 1;
  const errs = model.validateForPrint(n);
  assert.ok(errs.some((e) => e.includes('Uang diterima kurang')));
  n.paid = 7999000;
  assert.deepEqual(model.validateForPrint(n), []);
  n.payment = 'tempo';
  assert.ok(model.validateForPrint(n).some((e) => e.includes('jatuh tempo')));
  n.payment = 'qris';
  n.lines.push(Object.assign({}, n.lines[0], { id: 'x' }));
  assert.ok(model.validateForPrint(n).some((e) => e.includes('SN yang sama')));
});
test('nota: escape HTML, SN tampil, batal bertanda, tanpa teks "sementara"', () => {
  const n = model.newNota();
  model.addCustomLine(n, '<img src=x onerror=alert(1)>', 1, 1000);
  model.addProductLine(n, by('GAD.OPO.HP00123'));
  n.no = '261107001';
  n.salesCode = 'FL.1';
  const html = rcpt.renderReceiptHtml(n, { sales: [{ code: 'FL.1', name: 'Sales Uji', phone: '0812' }], now: new Date(2026, 10, 7, 18, 5) });
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('SN : 33333333'));
  assert.ok(html.includes('Sales : FL.1 - Sales Uji'));
  assert.ok(!/sementara|validasi/i.test(html));
  n.status = 'batal';
  assert.ok(rcpt.renderReceiptHtml(n, { sales: [], now: new Date() }).includes('NOTA BATAL'));
});
test('store lokal: simpan, ubah, tolak nomor ganda', async () => {
  const mem = {};
  global.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => (mem[k] = v), removeItem: (k) => delete mem[k] };
  const s = store.createLocalStore();
  assert.ok((await s.saveNota({ id: 'a', no: '1', lines: [] })).ok);
  assert.ok((await s.saveNota({ id: 'a', no: '1', status: 'lunas', lines: [] })).ok);
  assert.equal((await s.listNotas()).data.length, 1);
  const dup = await s.saveNota({ id: 'b', no: '1', lines: [] });
  assert.equal(dup.conflict, true);
});
