(function () {
  const ui = { q: '', jenis: '', onlyReady: false, tab: 'lines' };
  const GADGET_JENIS = ['hp', 'tablet', 'laptop', 'jam', 'gadlain'];

  const ctx = () => ({ sales: App.sales, now: new Date() });
  const receiptOf = () => renderReceiptHtml(withKasir(App.nota), ctx());
  const withKasir = (n) => Object.assign({}, n, { kasir: n.kasir || Settings.kasir });

  function resetNota() {
    App.nota = newNota();
    App.nota.kasir = Settings.kasir;
    $('formErrors').hidden = true;
    renderAll();
  }

  /* Data nota */
  function renderHead() {
    const n = App.nota;
    const active = App.sales.filter((s) => s.active !== false);
    const known = active.some((s) => s.code === n.salesCode);
    const opts = ['<option value="">Pilih sales</option>'].concat(
      active.map((s) => `<option value="${escapeHtml(s.code)}">${escapeHtml(s.code)} - ${escapeHtml(s.name)}</option>`),
    );
    if (n.salesCode && !known) opts.push(`<option value="${escapeHtml(n.salesCode)}">${escapeHtml(n.salesCode)} (nonaktif)</option>`);
    $('f-sales').innerHTML = opts.join('');
    $('f-sales').value = n.salesCode;
    $('salesHint').hidden = active.length > 0;
    if (!$('f-payment').options.length) {
      $('f-payment').innerHTML = PAYMENT_METHODS.map((m) => `<option value="${m.id}">${escapeHtml(m.label)}</option>`).join('');
    }
    $('f-payment').value = n.payment;
    $('f-cname').value = n.customerName;
    $('f-cphone').value = n.customerPhone;
    $('f-due').value = n.dueDate;
    $('dueField').hidden = n.payment !== 'tempo';
    $('f-no').textContent = n.no ? `No. ${n.no}${n.status === 'draft' ? ' · draf' : ''}` : 'Nomor dibuat saat disimpan';
  }

  /* Katalog */
  function catalogNotice() {
    const c = App.catalog;
    if (c.state === 'loading') return '<p class="empty">Memuat katalog dari server...</p>';
    if (c.state === 'error') {
      return `<div class="notice">Katalog gagal dimuat (${escapeHtml(c.errors.join(' | '))}). Biasanya karena sinyal. <button class="btn small" data-act="reload" type="button">Coba lagi</button></div>`;
    }
    if (c.meta.noInventory) {
      return '<p class="empty">Belum ada data katalog di server. Staf gudang perlu mengunggah file lewat web Cek Harga &amp; Stok dulu.</p>';
    }
    let warn = '';
    if (c.errors.length) {
      warn = `<div class="notice">Sebagian data gagal dimuat (${escapeHtml(c.errors.map((e) => e.split(':')[0]).join(', '))}). Stok atau harga bisa belum lengkap. <button class="btn small" data-act="reload" type="button">Muat ulang</button></div>`;
    } else if (c.meta.noPrices) {
      warn = '<div class="notice">Price List Reborn belum ada di server, jadi harga harus diisi manual.</div>';
    }
    return warn;
  }

  function productRow(p) {
    const stockText = p.state === 'ready' ? `${fmtNum(p.ready)} pcs` : '';
    const jenis = (PRODUCT_TYPES.find((t) => t.id === p.jenis) || { label: 'Lainnya' }).label;
    const price = p.price !== null ? `<div class="prod-price">${fmtRupiah(p.price)}</div>` : '<div class="prod-price none">Harga belum ada</div>';
    const sn = p.units.length ? `<span>SN ${p.units.length}</span>` : '';
    return (
      `<div class="prod"><div><div class="prod-desc">${escapeHtml(p.desc)}</div>` +
      `<div class="prod-meta"><span class="badge ${p.state}">${STOCK_LABEL[p.state]}${stockText ? ' ' + stockText : ''}</span><span>${escapeHtml(p.code)}</span><span>${escapeHtml(jenis)}</span>${sn}</div></div>` +
      `${price}<button class="btn small" type="button" data-add="${escapeHtml(p.code)}">Tambah</button></div>`
    );
  }

  function renderCatalog() {
    const c = App.catalog;
    const notice = catalogNotice();
    const ready = c.state !== 'loading' && c.state !== 'error' && !(c.meta && c.meta.noInventory);
    if (!ready) {
      $('chips').innerHTML = '';
      $('catList').innerHTML = notice;
      $('catMeta').textContent = '';
      return;
    }
    const counts = jenisCounts(App.products, ui.q, ui.onlyReady);
    const chips = PRODUCT_TYPES.concat([{ id: 'lainnya', label: 'Lainnya' }])
      .filter((t) => counts.get(t.id) || ui.jenis === t.id)
      .map((t) => `<button class="chip" type="button" data-jenis="${t.id}" aria-pressed="${ui.jenis === t.id}">${escapeHtml(t.label)}<span class="n">${counts.get(t.id) || 0}</span></button>`);
    $('chips').innerHTML = chips.join('');
    const found = searchProducts(App.products, ui.q, { jenis: ui.jenis, onlyReady: ui.onlyReady });
    let body;
    if (!ui.q.trim() && !ui.jenis) {
      body = '<p class="empty">Scan barcode, atau ketik nama, kode, atau SN. Pilih jenis di atas untuk menjelajah.</p>';
    } else if (!found.length) {
      body = '<p class="empty">Tidak ada barang yang cocok. Coba kata kunci lain, atau hilangkan filter.</p>';
    } else {
      body = found.slice(0, CATALOG_RESULT_LIMIT).map(productRow).join('');
      if (found.length > CATALOG_RESULT_LIMIT) {
        body += `<p class="more">Menampilkan ${CATALOG_RESULT_LIMIT} dari ${fmtNum(found.length)} barang. Persempit pencarian untuk melihat sisanya.</p>`;
      }
    }
    $('catList').innerHTML = notice + body;
    $('catMeta').textContent = `${fmtNum(App.products.length)} barang`;
  }

  /* Rincian */
  function lineWarnings(l) {
    const out = [];
    const p = App.productByCode.get(l.code);
    if (!l.custom && !l.priceKnown) out.push('Harga belum ada di Price List. Isi harga manual.');
    if (l.hasSn && !l.sn) out.push('Tidak ada SN tersisa untuk unit ini. Hapus baris ini atau cek stok.');
    if (p && p.state === 'indent') out.push('Stok toko kosong, barang ada di cabang lain (indent).');
    else if (p && (p.state === 'habis' || p.state === 'nonjual')) out.push('Stok toko kosong.');
    else if (p && p.state === 'ready' && !p.units.length && Number(l.qty) > p.ready) out.push(`Jumlah melebihi stok ready (${fmtNum(p.ready)}).`);
    return out;
  }

  function snField(l) {
    const p = App.productByCode.get(l.code);
    if (l.hasSn && p) {
      const opts = freeSerials(App.nota, p, l.id).map((u) => ({ serial: u.serial, label: u.serial + (u.date ? ` · masuk ${u.date}` : '') + (u.status === 'Allocated' ? ' · alokasi' : '') }));
      if (l.sn && !opts.some((o) => o.serial === l.sn)) opts.unshift({ serial: l.sn, label: l.sn });
      return `<div class="field"><label for="sn-${l.id}">SN (urut FIFO)</label><select id="sn-${l.id}" data-sn="${l.id}">${opts
        .map((o) => `<option value="${escapeHtml(o.serial)}"${o.serial === l.sn ? ' selected' : ''}>${escapeHtml(o.label)}</option>`)
        .join('')}</select></div>`;
    }
    if (!l.custom && p && GADGET_JENIS.includes(p.jenis)) {
      return `<div class="field"><label for="sn-${l.id}">SN (opsional, tidak ada di data)</label><input id="sn-${l.id}" type="text" class="mono" data-snfree="${l.id}" value="${escapeHtml(l.sn)}" autocomplete="off" /></div>`;
    }
    return '';
  }

  function renderLines() {
    const n = App.nota;
    $('linesEmpty').hidden = n.lines.length > 0;
    $('lines').innerHTML = n.lines
      .map((l) => {
        const warn = lineWarnings(l).map((w) => `<div class="line-warn">${escapeHtml(w)}</div>`).join('');
        return (
          `<li class="line" data-id="${l.id}"><div class="line-top"><div><div class="line-desc">${escapeHtml(l.desc)}</div>` +
          `<div class="mono muted">${l.custom ? 'Item kustom' : escapeHtml(l.code)}</div></div>` +
          `<button class="btn quiet small" type="button" data-del="${l.id}" aria-label="Hapus ${escapeHtml(l.desc)} dari nota">Hapus</button></div>` +
          `<div class="line-grid"><div class="field"><label for="q-${l.id}">Qty</label><input id="q-${l.id}" type="number" min="1" step="1" value="${l.qty}" data-qty="${l.id}"${l.hasSn ? ' disabled' : ''} /></div>` +
          `<div class="field"><label for="p-${l.id}">Harga satuan</label><input id="p-${l.id}" class="money mono" type="text" inputmode="numeric" value="${fmtNum(l.price)}" data-price="${l.id}" /></div>` +
          `<div class="line-sub mono" data-sub="${l.id}">${fmtNum(lineTotal(l))}</div></div>${snField(l)}${warn}</li>`
        );
      })
      .join('');
  }

  function renderTotals() {
    const n = App.nota;
    const t = totals(n);
    $('t-sub').textContent = fmtNum(t.subtotal);
    $('t-total').textContent = fmtRupiah(t.total);
    $('cashRow').hidden = !t.isCash;
    $('changeRow').hidden = !t.isCash;
    $('changeLabel').textContent = t.short > 0 && t.paid > 0 ? 'Kurang' : 'Kembalian';
    $('t-change').textContent = fmtRupiah(t.short > 0 && t.paid > 0 ? t.short : t.change);
    $('t-change').style.color = t.short > 0 && t.paid > 0 ? 'var(--err)' : '';
    const empty = n.lines.length === 0;
    ['btnPrint', 'btnDraft', 'btnPng', 'btnWa'].forEach((id) => ($(id).disabled = empty));
    n.lines.forEach((l) => {
      const el = document.querySelector(`[data-sub="${l.id}"]`);
      if (el) el.textContent = fmtNum(lineTotal(l));
    });
    if (ui.tab === 'preview') $('previewPaper').innerHTML = receiptOf();
  }

  function renderAll() {
    renderHead();
    renderLines();
    renderTotals();
    $('f-disc').value = fmtNum(App.nota.discount);
    $('f-paid').value = fmtNum(App.nota.paid);
  }

  function setTab(name) {
    ui.tab = name;
    ['lines', 'preview'].forEach((t) => {
      $('panel-' + t).hidden = t !== name;
      $('tab-' + t).setAttribute('aria-selected', String(t === name));
      $('tab-' + t).tabIndex = t === name ? 0 : -1;
    });
    if (name === 'preview') $('previewPaper').innerHTML = receiptOf();
  }

  /* Menambah barang */
  function add(product, serial) {
    addProductLine(App.nota, product, serial);
    $('formErrors').hidden = true;
    renderLines();
    renderTotals();
  }

  /* Menyimpan */
  async function persist(status) {
    const n = App.nota;
    const stamp = n.createdAt || new Date().toISOString();
    for (let attempt = 0; attempt < 3; attempt++) {
      const fresh = await App.store.listNotas();
      if (!fresh.ok) return { ok: false, message: fresh.message };
      App.notas = fresh.data;
      const draftNo = n.no || nextNotaNo(fresh.data.map((x) => x.no), new Date(stamp));
      const rec = Object.assign({}, withKasir(n), { no: draftNo, status, createdAt: stamp, paid: totals(n).paid });
      const r = await App.store.saveNota(rec);
      if (r.ok) {
        App.nota = rec;
        App.notas = App.notas.filter((x) => x.id !== rec.id).concat(rec);
        App.emit('data');
        return { ok: true, nota: rec };
      }
      if (!r.conflict) return r;
      n.no = '';
    }
    return { ok: false, message: 'Nomor nota bentrok berulang kali. Coba lagi.' };
  }

  function showErrors(list) {
    const box = $('formErrors');
    if (!list.length) {
      box.hidden = true;
      return;
    }
    box.innerHTML = `<ul>${list.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`;
    box.hidden = false;
  }

  async function onDraft() {
    if (!App.nota.lines.length) return;
    const r = await persist('draft');
    if (!r.ok) return toast(`Draf gagal disimpan: ${r.message}`, true);
    showErrors([]);
    renderHead();
    toast(`Draf tersimpan: ${r.nota.no}`);
  }

  async function onPrint() {
    const errs = validateForPrint(App.nota);
    showErrors(errs);
    if (errs.length) return;
    const r = await persist('lunas');
    if (!r.ok) return toast(`Nota gagal disimpan: ${r.message}`, true);
    const saved = r.nota;
    printReceipt(renderReceiptHtml(saved, ctx()));
    toast(`Nota ${saved.no} tersimpan. Cetak ulang ada di Riwayat Nota.`);
    resetNota();
  }

  async function onPng() {
    if (!App.nota.lines.length) return;
    const btn = $('btnPng');
    btn.disabled = true;
    try {
      const blob = await receiptToPngBlob(receiptOf());
      downloadBlob(blob, `nota-${App.nota.no || 'draf'}.png`);
    } catch (e) {
      toast(`Gagal membuat gambar: ${e.message}`, true);
    } finally {
      btn.disabled = App.nota.lines.length === 0;
    }
  }

  function onWa() {
    const num = waNumber(App.nota.customerPhone);
    if (!num) {
      showErrors(['Isi No. HP pelanggan yang valid untuk mengirim lewat WhatsApp.']);
      $('f-cphone').focus();
      return;
    }
    showErrors([]);
    const text = receiptText(withKasir(App.nota), ctx());
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }

  function onReset() {
    if (App.nota.lines.length && !confirm('Kosongkan nota ini? Barang yang sudah dimasukkan akan hilang.')) return;
    resetNota();
  }

  /* Pemasangan */
  function bind() {
    const q = $('q');
    q.addEventListener('input', debounce(() => {
      ui.q = q.value;
      renderCatalog();
    }, 120));
    q.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      ui.q = q.value;
      const hit = findExact(App.products, q.value);
      if (!hit) return renderCatalog();
      add(hit.product, hit.serial);
      toast(`Ditambahkan: ${hit.product.desc}`);
      q.value = '';
      ui.q = '';
      renderCatalog();
    });
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !$('view-buat').hidden) {
        e.preventDefault();
        q.focus();
        q.select();
      }
    });
    $('onlyReady').addEventListener('change', (e) => {
      ui.onlyReady = e.target.checked;
      renderCatalog();
    });
    $('chips').addEventListener('click', (e) => {
      const b = e.target.closest('[data-jenis]');
      if (!b) return;
      ui.jenis = ui.jenis === b.dataset.jenis ? '' : b.dataset.jenis;
      renderCatalog();
    });
    $('catList').addEventListener('click', (e) => {
      const a = e.target.closest('[data-add]');
      if (a) {
        const p = App.productByCode.get(a.dataset.add);
        if (p) add(p);
      } else if (e.target.closest('[data-act="reload"]')) {
        App.loadCatalog();
      }
    });

    $('btnCustom').addEventListener('click', () => {
      const box = $('customBox');
      box.hidden = !box.hidden;
      $('btnCustom').setAttribute('aria-expanded', String(!box.hidden));
      if (!box.hidden) $('c-desc').focus();
    });
    $('btnCustomAdd').addEventListener('click', () => {
      const desc = $('c-desc').value.trim();
      if (!desc) {
        showErrors(['Isi nama barang kustom.']);
        return $('c-desc').focus();
      }
      addCustomLine(App.nota, desc, $('c-qty').value, parseMoney($('c-price').value));
      $('c-desc').value = '';
      $('c-qty').value = '1';
      $('c-price').value = '0';
      showErrors([]);
      renderLines();
      renderTotals();
    });

    const field = (id, key, ev) =>
      $(id).addEventListener(ev || 'input', (e) => {
        App.nota[key] = e.target.value;
        if (key === 'payment') {
          $('dueField').hidden = e.target.value !== 'tempo';
        }
        renderTotals();
      });
    field('f-sales', 'salesCode', 'change');
    field('f-payment', 'payment', 'change');
    field('f-cname', 'customerName');
    field('f-cphone', 'customerPhone');
    field('f-due', 'dueDate', 'change');
    $('f-disc').addEventListener('input', (e) => {
      App.nota.discount = parseMoney(e.target.value);
      renderTotals();
    });
    $('f-paid').addEventListener('input', (e) => {
      App.nota.paid = parseMoney(e.target.value);
      renderTotals();
    });

    $('view-buat').addEventListener('focusout', (e) => {
      if (e.target.classList && e.target.classList.contains('money')) e.target.value = fmtNum(parseMoney(e.target.value));
    });

    const lines = $('lines');
    lines.addEventListener('input', (e) => {
      const t = e.target;
      const line = (id) => App.nota.lines.find((l) => l.id === id);
      if (t.dataset.qty) {
        line(t.dataset.qty).qty = Math.max(parseInt(t.value, 10) || 0, 0);
        renderTotals();
      } else if (t.dataset.price) {
        line(t.dataset.price).price = parseMoney(t.value);
        renderTotals();
      } else if (t.dataset.snfree) {
        line(t.dataset.snfree).sn = t.value.trim();
        if (ui.tab === 'preview') renderTotals();
      }
    });
    lines.addEventListener('change', (e) => {
      const id = e.target.dataset.sn;
      if (!id) return;
      App.nota.lines.find((l) => l.id === id).sn = e.target.value;
      renderLines();
      renderTotals();
    });
    lines.addEventListener('click', (e) => {
      const d = e.target.closest('[data-del]');
      if (!d) return;
      App.nota.lines = App.nota.lines.filter((l) => l.id !== d.dataset.del);
      renderLines();
      renderTotals();
    });

    $('tab-lines').addEventListener('click', () => setTab('lines'));
    $('tab-preview').addEventListener('click', () => setTab('preview'));
    document.querySelector('.tabs').addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const next = ui.tab === 'lines' ? 'preview' : 'lines';
      setTab(next);
      $('tab-' + next).focus();
    });

    $('btnPrint').addEventListener('click', onPrint);
    $('btnDraft').addEventListener('click', onDraft);
    $('btnPng').addEventListener('click', onPng);
    $('btnWa').addEventListener('click', onWa);
    $('btnReset').addEventListener('click', onReset);

    App.on('catalog', () => {
      renderCatalog();
      renderLines();
    });
    App.on('data', () => {
      if (!$('view-buat').hidden) renderHead();
    });
  }

  App.views.buat = {
    init() {
      resetNota();
      renderCatalog();
      bind();
    },
    show() {
      renderHead();
      renderCatalog();
    },
    // Dipakai Riwayat untuk melanjutkan draf.
    load(nota) {
      App.nota = JSON.parse(JSON.stringify(nota));
      $('formErrors').hidden = true;
      renderAll();
      setTab('lines');
      location.hash = '#buat';
    },
  };
})();
