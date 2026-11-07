// Uji klik di Chromium sungguhan. Jalankan: node tests/e2e.mjs (butuh playwright + chromium terpasang).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || 'playwright');
const raw = require('./fixture.cjs');
const root = path.resolve(import.meta.dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((q, r) => {
  const f = path.join(root, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
  if (!f.startsWith(root) || !fs.existsSync(f)) return r.writeHead(404).end();
  r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }).end(fs.readFileSync(f));
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
await ctx.route(/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await ctx.addInitScript((data) => {
  window.NOTA_TEST_FETCH = async (key) => ({ ok: true, payload: data[key.split(':')[0]] || null, message: '' });
  window.print = () => { window.__printed = document.getElementById('printArea').innerHTML; };
  window.confirm = () => true;
  window.open = (u) => { window.__opened = u; };
}, raw);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(base);
await page.waitForFunction(() => document.getElementById('catStatus').textContent.includes('barang'));

// Pengaturan: tambah sales
await page.click('a[data-route="pengaturan"]');
await page.fill('#sl-code', 'fl.uji.01');
await page.click('#btnSalesSave');
ok(await page.isVisible('#salesError'), 'sales tanpa nama ditolak dengan pesan');
await page.fill('#sl-name', 'Sales Uji');
await page.fill('#sl-phone', '0812-5541-0982');
await page.click('#btnSalesSave');
ok((await page.textContent('#salesBody')).includes('FL.UJI.01'), 'sales tersimpan, kode jadi huruf besar');
await page.fill('#s-kasir', 'KASIR UJI 01');
await page.click('#btnKasir');

// Buat nota
await page.click('a[data-route="buat"]');
await page.waitForSelector('#view-buat:not([hidden])');
ok((await page.textContent('#f-sales')).includes('Sales Uji'), 'sales muncul di dropdown nota');
ok(await page.isDisabled('#btnPrint'), 'Cetak nonaktif saat nota kosong');
await page.fill('#q', 'oppo');
await page.waitForSelector('[data-add]');
await page.click('[data-add="GAD.OPO.HP00123"]');
ok((await page.inputValue('select[data-sn]')).startsWith('3333'), 'SN FIFO terdepan terpilih otomatis');
await page.fill('#q', '8801234567890');
await page.press('#q', 'Enter');
ok((await page.locator('.line').count()) === 2, 'scan barcode + Enter menambah baris');
await page.click('[data-del]');
await page.fill('#q', 'anker');
await page.click('[data-add="ACC.ANK.CH00001"]');
await page.click('[data-add="ACC.ANK.CH00001"]');
ok((await page.inputValue('.line:has-text("ANKER") [data-qty]')) === '2', 'aksesoris digabung jadi qty 2');
await page.click('#btnCustom');
await page.fill('#c-desc', 'TAS GADGETMART');
await page.click('#btnCustomAdd');
ok((await page.locator('.line').count()) === 3, 'item kustom masuk');

await page.click('#btnPrint');
ok(/Pilih sales/.test(await page.textContent('#formErrors')), 'cetak tanpa sales ditolak');
await page.selectOption('#f-sales', 'FL.UJI.01');
await page.fill('#f-disc', '46000');
await page.fill('#f-paid', '8500000');
const total = await page.textContent('#t-total');
ok(total.replace(/\D/g, '') === String(7999000 + 480000 - 46000), `total benar (${total})`);
await page.click('#tab-preview');
const prev = await page.textContent('#previewPaper');
ok(prev.includes('KASIR UJI 01') && prev.includes('GADGETMART') && !/sementara/i.test(prev), 'pratinjau memuat kop dan kasir');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btnPng')]);
const png = fs.readFileSync(await dl.path());
ok(png.slice(0, 4).toString('hex') === '89504e47' && png.length > 3000, `unduh gambar PNG valid (${png.length} B)`);
await page.fill('#f-cphone', '081255410982');
await page.click('#btnWa');
ok((await page.evaluate(() => window.__opened)).startsWith('https://wa.me/6281255410982?text='), 'WA membuka wa.me dengan nomor 62');
await page.click('#tab-lines');
await page.fill('#f-paid', '8000000');
await page.click('#btnPrint');
ok(/kurang Rp 433\.000/.test(await page.textContent('#formErrors')), 'uang kurang ditolak dengan nominal kekurangan');
await page.fill('#f-paid', '8500000');
await page.click('#btnPrint');
ok(await page.evaluate(() => (window.__printed || '').includes('SN : 2222')), 'cetak mengisi area cetak berisi SN');
ok((await page.locator('.line').count()) === 0, 'nota di-reset setelah cetak');

// Riwayat
await page.click('a[data-route="riwayat"]');
await page.waitForSelector('#histBody tr');
const row = await page.textContent('#histBody');
ok(/\d{9}/.test(row) && row.includes('Lunas'), 'nota muncul di riwayat berstatus Lunas');
ok((await page.textContent('#summary')).includes('Rp 8.433.000'), 'omzet rekap benar');
await page.click('[data-open]');
await page.click('#dlgVoid');
ok((await page.textContent('#histBody')).includes('Batal'), 'nota bisa dibatalkan');
await page.click('#dlgClose');
const [csv] = await Promise.all([page.waitForEvent('download'), page.click('#btnCsv')]);
ok(fs.readFileSync(await csv.path(), 'utf8').includes('Sales Uji'), 'ekspor CSV berisi data');

// Draf lalu lanjutkan
await page.click('a[data-route="buat"]');
await page.fill('#q', 'oppo');
await page.click('[data-add="GAD.OPO.HP00123"]');
await page.click('#btnDraft');
await page.click('a[data-route="riwayat"]');
await page.selectOption('#r-status', 'draft');
await page.click('[data-open]');
await page.click('#dlgResume');
ok(page.url().endsWith('#buat') && (await page.locator('.line').count()) === 1, 'draf dibuka kembali di Buat Nota');

// Responsif + teks tak meluap
await page.setViewportSize({ width: 375, height: 800 });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
ok(!overflow, 'tidak ada scroll horizontal di 375 px');
await page.screenshot({ path: '/tmp/buat-mobile.png', fullPage: true });
await page.setViewportSize({ width: 1280, height: 900 });
await page.screenshot({ path: '/tmp/buat-desktop.png' });
ok(errors.length === 0, 'tanpa error konsol' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
