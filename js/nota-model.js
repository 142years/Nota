if (typeof module !== 'undefined') Object.assign(globalThis, require('./config.js'), require('./helpers.js'));

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function newNota() {
  return {
    id: uid(),
    no: '',
    createdAt: null,
    salesCode: '',
    customerName: '',
    customerPhone: '',
    payment: 'tunai',
    dueDate: '',
    lines: [],
    discount: 0,
    paid: 0,
    status: 'draft',
    kasir: '',
  };
}

function lineTotal(l) {
  return Math.round((Number(l.qty) || 0) * (Number(l.price) || 0));
}

function totals(n) {
  const subtotal = n.lines.reduce((s, l) => s + lineTotal(l), 0);
  const discount = Math.min(Math.max(Math.round(Number(n.discount) || 0), 0), subtotal);
  const total = subtotal - discount;
  const qty = n.lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  const isCash = (PAYMENT_METHODS.find((m) => m.id === n.payment) || {}).cash;
  const paid = isCash ? Math.round(Number(n.paid) || 0) : total;
  return { subtotal, discount, total, qty, paid, change: Math.max(paid - total, 0), short: Math.max(total - paid, 0), isCash: !!isCash };
}

// SN yang belum dipakai baris lain di nota ini, urut FIFO.
function freeSerials(n, product, exceptLineId) {
  const used = new Set(n.lines.filter((l) => l.id !== exceptLineId && l.sn).map((l) => l.sn));
  return product.units.filter((u) => !used.has(u.serial));
}

// Barang ber-SN (HP) selalu satu baris per unit dengan SN FIFO terdepan. Barang tanpa SN digabung per kode.
function addProductLine(n, product, serial) {
  if (product.units.length) {
    const free = freeSerials(n, product);
    const sn = serial && free.some((u) => u.serial === serial) ? serial : free[0] ? free[0].serial : '';
    n.lines.push({ id: uid(), code: product.code, desc: product.desc, qty: 1, price: product.price || 0, sn, hasSn: true, priceKnown: product.price !== null, custom: false });
    return n.lines[n.lines.length - 1];
  }
  const same = n.lines.find((l) => l.code === product.code && !l.custom);
  if (same) {
    same.qty = (Number(same.qty) || 0) + 1;
    return same;
  }
  n.lines.push({ id: uid(), code: product.code, desc: product.desc, qty: 1, price: product.price || 0, sn: '', hasSn: false, priceKnown: product.price !== null, custom: false });
  return n.lines[n.lines.length - 1];
}

function addCustomLine(n, desc, qty, price) {
  n.lines.push({ id: uid(), code: '', desc: String(desc).trim(), qty: Number(qty) || 1, price: Math.max(Math.round(Number(price) || 0), 0), sn: '', hasSn: false, priceKnown: true, custom: true });
  return n.lines[n.lines.length - 1];
}

// Format YYMMDD + urutan 3 digit per hari, mengikuti pola nomor nota SAP di desain (260303375).
function nextNotaNo(existingNos, date) {
  const d = new Date(date);
  const prefix = `${String(d.getFullYear()).slice(2)}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
  let max = 0;
  existingNos.forEach((no) => {
    if (String(no).startsWith(prefix)) max = Math.max(max, parseInt(String(no).slice(prefix.length), 10) || 0);
  });
  return prefix + String(max + 1).padStart(3, '0');
}

// Daftar pesan kesalahan. Kosong = boleh dicetak.
function validateForPrint(n) {
  const errs = [];
  const t = totals(n);
  if (!n.lines.length) errs.push('Nota masih kosong. Tambahkan barang dulu.');
  if (!n.salesCode) errs.push('Pilih sales.');
  n.lines.forEach((l, i) => {
    const name = l.desc || `baris ${i + 1}`;
    if (!(Number(l.qty) > 0)) errs.push(`Jumlah "${name}" harus lebih dari 0.`);
    if (!String(l.desc).trim()) errs.push(`Nama barang baris ${i + 1} kosong.`);
    if (l.hasSn && !l.sn) errs.push(`SN "${name}" belum diisi.`);
  });
  const sns = n.lines.filter((l) => l.sn).map((l) => l.sn);
  if (new Set(sns).size !== sns.length) errs.push('Ada SN yang sama di dua baris.');
  if (n.payment === 'tempo' && !n.dueDate) errs.push('Isi tanggal jatuh tempo untuk pembayaran tempo.');
  if (t.isCash && t.total > 0 && t.short > 0) errs.push(`Uang diterima kurang ${fmtRupiah(t.short)}.`);
  return errs;
}

if (typeof module !== 'undefined') {
  module.exports = { newNota, lineTotal, totals, freeSerials, addProductLine, addCustomLine, nextNotaNo, validateForPrint, uid };
}
