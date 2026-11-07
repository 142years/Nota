if (typeof module !== 'undefined')
  Object.assign(globalThis, require('./config.js'), require('./helpers.js'), require('./nota-model.js'));

const paymentLabel = (id) => (PAYMENT_METHODS.find((m) => m.id === id) || { label: id }).label;

// ctx: { sales: [{code,name,phone}], now: Date }. Nota yang sudah tersimpan memakai createdAt-nya.
function renderReceiptHtml(nota, ctx) {
  const t = totals(nota);
  const when = nota.createdAt ? new Date(nota.createdAt) : ctx.now;
  const s = (ctx.sales || []).find((x) => x.code === nota.salesCode);
  const rows = nota.lines
    .map((l, i) => {
      const sn = l.sn ? `<div class="r-sub">SN : ${escapeHtml(l.sn)}</div>` : '';
      return (
        `<tr><td class="r-desc"><div>${i + 1}. ${escapeHtml(l.desc)}</div>${sn}</td>` +
        `<td class="r-qty">${fmtNum(l.qty)}</td><td class="r-num">${fmtNum(l.price)}</td><td class="r-num">${fmtNum(lineTotal(l))}</td></tr>`
      );
    })
    .join('');
  const customer = nota.customerName || nota.customerPhone
    ? `<div>Pelanggan : ${escapeHtml(nota.customerName)}${nota.customerPhone ? ' / ' + escapeHtml(nota.customerPhone) : ''}</div>`
    : '';
  const salesLine = s
    ? `<div>Sales : ${escapeHtml(s.code)} - ${escapeHtml(s.name)}</div>${s.phone ? `<div>Telp : ${escapeHtml(s.phone)}</div>` : ''}`
    : nota.salesCode
      ? `<div>Sales : ${escapeHtml(nota.salesCode)}</div>`
      : '';
  const cash = t.isCash && t.paid > 0
    ? `<div class="r-row"><span>Bayar</span><span>${fmtNum(t.paid)}</span></div><div class="r-row"><span>Kembali</span><span>${fmtNum(t.change)}</span></div>`
    : '';
  const void_ = nota.status === 'batal' ? '<div class="r-void">NOTA BATAL</div>' : '';
  return (
    `<div class="receipt">${void_}` +
    `<div class="r-head"><div class="r-brand">${escapeHtml(COMPANY.brand)}</div>` +
    `<div class="r-pay">${escapeHtml(paymentLabel(nota.payment))}</div>` +
    `<div>${escapeHtml(COMPANY.legalName)}</div><div>Telp : ${escapeHtml(COMPANY.phone)}</div><div>${escapeHtml(COMPANY.address)}</div></div>` +
    `<div class="r-meta"><div class="r-row"><span>Tgl : ${fmtDate(when)}</span><span>${fmtTime(when)}</span></div>` +
    `<div class="r-row"><span>NPWP: ${escapeHtml(COMPANY.npwp)}</span>${nota.payment === 'tempo' && nota.dueDate ? `<span>J/T : ${fmtDate(nota.dueDate)}</span>` : ''}</div></div>` +
    `<div class="r-no">${escapeHtml(nota.no || '(nomor dibuat saat disimpan)')}</div>` +
    `<table class="r-items"><thead><tr><th>Perincian</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>` +
    `<tbody>${rows || '<tr><td colspan="4" class="r-empty">Belum ada barang</td></tr>'}</tbody></table>` +
    `<div class="r-foot">${customer}${salesLine}<div>Total Qty : ${t.qty.toFixed(2)}</div>${nota.kasir ? `<div>${escapeHtml(nota.kasir)}</div>` : ''}</div>` +
    `<div class="r-sum"><div class="r-row"><span>Sub Total</span><span>${fmtNum(t.subtotal)}</span></div>` +
    `<div class="r-row"><span>Disc</span><span>${fmtNum(t.discount)}</span></div>` +
    `<div class="r-row r-total"><span>Total</span><span>${fmtNum(t.total)}</span></div>${cash}</div>` +
    `<div class="r-note">${escapeHtml(COMPANY.footerNote)}</div>` +
    `<div class="r-sign"><span>Hormat kami,</span><span>Penerima,</span><span>Pemeriksa,</span></div>` +
    `<div class="r-note">${escapeHtml(COMPANY.taxNote)}</div>` +
    `<div class="r-print">Print: ${fmtDate(ctx.now)} ${fmtTime(ctx.now)}</div></div>`
  );
}

// Teks untuk WhatsApp. Gambar tidak bisa dilampirkan lewat tautan, jadi hanya ringkasan.
function receiptText(nota, ctx) {
  const t = totals(nota);
  const when = nota.createdAt ? new Date(nota.createdAt) : ctx.now;
  const lines = nota.lines.map((l, i) => `${i + 1}. ${l.desc} x${fmtNum(l.qty)} = ${fmtRupiah(lineTotal(l))}${l.sn ? `\n   SN: ${l.sn}` : ''}`);
  return [
    `${COMPANY.brand} - Nota ${nota.no}`,
    `${fmtDate(when)} ${fmtTime(when)}`,
    '',
    ...lines,
    '',
    t.discount ? `Diskon: ${fmtRupiah(t.discount)}` : null,
    `Total: ${fmtRupiah(t.total)} (${paymentLabel(nota.payment)})`,
    '',
    'Terima kasih sudah berbelanja.',
  ]
    .filter((x) => x !== null)
    .join('\n');
}

// Cetak lewat area khusus: CSS @media print menyembunyikan seluruh halaman kecuali #printArea.
function printReceipt(html) {
  const area = document.getElementById('printArea');
  area.innerHTML = html;
  const done = () => {
    area.innerHTML = '';
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
}

// html2canvas dimuat dari vendor/ (salinan lokal) supaya tetap jalan tanpa internet.
async function receiptToPngBlob(html) {
  if (typeof html2canvas === 'undefined') throw new Error('Pustaka gambar belum termuat. Muat ulang halaman.');
  const holder = document.createElement('div');
  holder.className = 'png-holder';
  holder.innerHTML = html;
  document.body.appendChild(holder);
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const canvas = await html2canvas(holder.firstElementChild, { scale: 3, backgroundColor: '#ffffff', useCORS: true });
    return await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Gagal membuat gambar'))), 'image/png'));
  } finally {
    holder.remove();
  }
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

if (typeof module !== 'undefined') module.exports = { renderReceiptHtml, receiptText, paymentLabel };
