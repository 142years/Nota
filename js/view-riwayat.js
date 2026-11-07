(function () {
  const STATUS_LABEL = { lunas: 'Lunas', draft: 'Draf', batal: 'Batal' };
  let openId = null;

  const ctx = () => ({ sales: App.sales, now: new Date() });

  function inRange(n, range, now) {
    if (range === 'all') return true;
    const d = new Date(n.createdAt);
    if (range === 'today') return dayKey(d) === dayKey(now);
    if (range === 'yesterday') return dayKey(d) === dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    if (range === '7d') return d >= new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    if (range === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    return true;
  }

  function filtered() {
    const now = new Date();
    const range = $('r-range').value;
    const sales = $('r-sales').value;
    const pay = $('r-pay').value;
    const status = $('r-status').value;
    const q = $('r-q').value.trim().toLowerCase();
    return App.notas
      .filter((n) => {
        if (!inRange(n, range, now)) return false;
        if (sales && n.salesCode !== sales) return false;
        if (pay && n.payment !== pay) return false;
        if (status && n.status !== status) return false;
        if (!q) return true;
        const hay = [n.no, n.customerName, n.customerPhone, n.salesCode, App.salesName(n.salesCode)]
          .concat(n.lines.flatMap((l) => [l.desc, l.code, l.sn]))
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || String(b.no).localeCompare(String(a.no)));
  }

  function renderFilters() {
    const salesSel = $('r-sales');
    const keep = salesSel.value;
    const codes = Array.from(new Set(App.notas.map((n) => n.salesCode).filter(Boolean).concat(App.sales.map((s) => s.code)))).sort();
    salesSel.innerHTML =
      '<option value="">Semua sales</option>' +
      codes.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}${App.salesName(c) ? ' - ' + escapeHtml(App.salesName(c)) : ''}</option>`).join('');
    salesSel.value = codes.includes(keep) ? keep : '';
    const pay = $('r-pay');
    if (!pay.options.length) {
      pay.innerHTML = '<option value="">Semua metode</option>' + PAYMENT_METHODS.map((m) => `<option value="${m.id}">${escapeHtml(m.label)}</option>`).join('');
    }
  }

  function renderSummary(list) {
    const paid = list.filter((n) => n.status === 'lunas');
    const omzet = paid.reduce((s, n) => s + totals(n).total, 0);
    const bySales = new Map();
    paid.forEach((n) => {
      const cur = bySales.get(n.salesCode) || { n: 0, omzet: 0 };
      cur.n += 1;
      cur.omzet += totals(n).total;
      bySales.set(n.salesCode, cur);
    });
    const top = Array.from(bySales.entries()).sort((a, b) => b[1].n - a[1].n || b[1].omzet - a[1].omzet)[0];
    const draft = list.filter((n) => n.status === 'draft').length;
    const batal = list.filter((n) => n.status === 'batal').length;
    $('summary').innerHTML =
      `<div><dt>Nota lunas</dt><dd>${fmtNum(paid.length)}<small>${draft} draf · ${batal} batal</small></dd></div>` +
      `<div><dt>Omzet</dt><dd>${fmtRupiah(omzet)}<small>Setelah diskon, nota lunas saja</small></dd></div>` +
      `<div><dt>Rata-rata per nota</dt><dd>${paid.length ? fmtRupiah(omzet / paid.length) : '-'}</dd></div>` +
      `<div><dt>Sales teratas</dt><dd>${top ? escapeHtml(App.salesName(top[0]) || top[0] || '(tanpa sales)') : '-'}<small>${top ? top[1].n + ' nota' : 'Belum ada nota lunas'}</small></dd></div>`;
  }

  function itemSummary(n) {
    if (!n.lines.length) return '-';
    const first = escapeHtml(n.lines[0].desc);
    const more = n.lines.length > 1 ? ` <span class="cell-sub">+${n.lines.length - 1} lainnya</span>` : '';
    return `${first}${more}<div class="cell-sub">Qty ${totals(n).qty}</div>`;
  }

  function render() {
    renderFilters();
    const list = filtered();
    renderSummary(list);
    const empty = $('histEmpty');
    $('histBody').innerHTML = list
      .map((n) => {
        const t = totals(n);
        const when = new Date(n.createdAt);
        return (
          `<tr><td class="mono">${escapeHtml(n.no)}</td><td>${fmtDate(when)}<div class="cell-sub">${fmtTime(when)}</div></td>` +
          `<td>${escapeHtml(App.salesName(n.salesCode) || n.salesCode || '-')}<div class="cell-sub mono">${escapeHtml(n.salesCode)}</div></td>` +
          `<td>${itemSummary(n)}</td><td>${escapeHtml(paymentLabel(n.payment))}</td>` +
          `<td class="num">${fmtRupiah(t.total)}${t.discount ? `<div class="cell-sub">Disc -${fmtNum(t.discount)}</div>` : ''}</td>` +
          `<td><span class="badge ${n.status}">${STATUS_LABEL[n.status] || escapeHtml(n.status)}</span></td>` +
          `<td><div class="row-actions"><button class="btn small" type="button" data-open="${n.id}">Lihat</button></div></td></tr>`
        );
      })
      .join('');
    $('histTable').hidden = list.length === 0;
    empty.hidden = list.length > 0;
    if (!list.length) {
      empty.textContent = App.notas.length
        ? 'Tidak ada nota yang cocok dengan filter ini.'
        : 'Belum ada nota tersimpan. Nota pertama muncul di sini setelah dicetak atau disimpan sebagai draf.';
    }
    $('btnCsv').disabled = list.length === 0;
  }

  function dialogActions(n) {
    const btn = (id, label, cls) => `<button id="${id}" class="btn ${cls || ''}" type="button">${label}</button>`;
    if (n.status === 'draft') return btn('dlgResume', 'Lanjutkan draf', 'primary') + btn('dlgPng', 'Unduh gambar') + btn('dlgVoid', 'Batalkan draf', 'danger');
    if (n.status === 'lunas') return btn('dlgPrint', 'Cetak ulang', 'primary') + btn('dlgPng', 'Unduh gambar') + btn('dlgWa', 'Kirim ringkasan WA') + btn('dlgVoid', 'Batalkan nota', 'danger');
    return btn('dlgPng', 'Unduh gambar');
  }

  function openDialog(id) {
    const n = App.notas.find((x) => x.id === id);
    if (!n) return;
    openId = id;
    $('dlgTitle').textContent = `Nota ${n.no}`;
    $('dlgPaper').innerHTML = renderReceiptHtml(n, ctx());
    $('dlgActions').innerHTML = dialogActions(n);
    const dlg = $('notaDialog');
    if (!dlg.open) dlg.showModal();
  }

  async function voidNota(n) {
    if (!confirm(`Batalkan nota ${n.no}? Nota tetap tersimpan dengan status batal.`)) return;
    const rec = Object.assign({}, n, { status: 'batal', voidedAt: new Date().toISOString() });
    const r = await App.store.saveNota(rec);
    if (!r.ok) return toast(`Gagal membatalkan: ${r.message}`, true);
    App.notas = App.notas.map((x) => (x.id === rec.id ? rec : x));
    App.emit('data');
    openDialog(rec.id);
    toast(`Nota ${rec.no} dibatalkan.`);
  }

  function exportCsv() {
    const list = filtered();
    const head = ['No Nota', 'Tanggal', 'Waktu', 'Kode Sales', 'Nama Sales', 'Pelanggan', 'No HP', 'Metode', 'Status', 'Barang', 'SN', 'Subtotal', 'Diskon', 'Total'];
    const rows = list.map((n) => {
      const t = totals(n);
      const d = new Date(n.createdAt);
      return [
        n.no, fmtDate(d), fmtTime(d), n.salesCode, App.salesName(n.salesCode), n.customerName, n.customerPhone, paymentLabel(n.payment),
        STATUS_LABEL[n.status] || n.status, n.lines.map((l) => `${l.desc} x${l.qty}`).join(' | '), n.lines.map((l) => l.sn).filter(Boolean).join(' | '),
        t.subtotal, t.discount, t.total,
      ];
    });
    // BOM + titik koma agar langsung terbaca benar di Excel berlokal Indonesia.
    const csv = '\uFEFF' + [head].concat(rows).map((r) => r.map(csvCell).join(';')).join('\r\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `riwayat-nota-${dayKey(new Date())}.csv`);
  }

  function bind() {
    ['r-range', 'r-sales', 'r-pay', 'r-status'].forEach((id) => $(id).addEventListener('change', render));
    $('r-q').addEventListener('input', debounce(render, 150));
    $('histBody').addEventListener('click', (e) => {
      const b = e.target.closest('[data-open]');
      if (b) openDialog(b.dataset.open);
    });
    $('btnCsv').addEventListener('click', exportCsv);

    const dlg = $('notaDialog');
    $('dlgClose').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) dlg.close();
    });
    dlg.addEventListener('close', () => (openId = null));
    $('dlgActions').addEventListener('click', async (e) => {
      const id = e.target.id;
      const n = App.notas.find((x) => x.id === openId);
      if (!n || !id) return;
      if (id === 'dlgPrint') printReceipt(renderReceiptHtml(n, ctx()));
      else if (id === 'dlgResume') {
        dlg.close();
        App.views.buat.load(n);
      } else if (id === 'dlgVoid') await voidNota(n);
      else if (id === 'dlgPng') {
        try {
          downloadBlob(await receiptToPngBlob(renderReceiptHtml(n, ctx())), `nota-${n.no}.png`);
        } catch (err) {
          toast(`Gagal membuat gambar: ${err.message}`, true);
        }
      } else if (id === 'dlgWa') {
        const num = waNumber(n.customerPhone);
        if (!num) return toast('Nota ini tidak punya No. HP pelanggan yang valid.', true);
        window.open(`https://wa.me/${num}?text=${encodeURIComponent(receiptText(n, ctx()))}`, '_blank', 'noopener');
      }
    });
    App.on('data', () => {
      if (!$('view-riwayat').hidden) render();
    });
  }

  App.views.riwayat = {
    init: bind,
    show: render,
  };
})();
