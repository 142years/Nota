(function () {
  let editing = null;

  function showError(list) {
    const box = $('salesError');
    box.hidden = !list.length;
    box.innerHTML = list.length ? `<ul>${list.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>` : '';
  }

  function resetForm() {
    editing = null;
    $('salesFormTitle').textContent = 'Tambah sales';
    ['sl-code', 'sl-name', 'sl-phone', 'sl-branch'].forEach((id) => ($(id).value = ''));
    $('sl-code').disabled = false;
    $('sl-active').checked = true;
    showError([]);
  }

  function fillForm(s) {
    editing = s.code;
    $('salesFormTitle').textContent = `Ubah sales ${s.code}`;
    $('sl-code').value = s.code;
    $('sl-code').disabled = true;
    $('sl-name').value = s.name;
    $('sl-phone').value = s.phone || '';
    $('sl-branch').value = s.branch || '';
    $('sl-active').checked = s.active !== false;
    showError([]);
    $('sl-name').focus();
    $('sl-code').scrollIntoView({ block: 'center', behavior: 'auto' });
  }

  function paidCount(code) {
    return App.notas.filter((n) => n.salesCode === code && n.status === 'lunas').length;
  }

  function renderSales() {
    const q = $('sl-q').value.trim().toLowerCase();
    const f = $('sl-filter').value;
    const list = App.sales
      .filter((s) => (f === 'active' ? s.active !== false : f === 'inactive' ? s.active === false : true))
      .filter((s) => !q || `${s.code} ${s.name}`.toLowerCase().includes(q))
      .sort((a, b) => a.code.localeCompare(b.code));
    const activeCount = App.sales.filter((s) => s.active !== false).length;
    $('salesCount').textContent = `${App.sales.length} terdaftar · ${activeCount} aktif`;
    $('salesBody').innerHTML = list
      .map(
        (s) =>
          `<tr><td class="mono">${escapeHtml(s.code)}</td><td>${escapeHtml(s.name)}</td><td class="mono">${escapeHtml(s.phone || '-')}</td><td>${escapeHtml(s.branch || '-')}</td>` +
          `<td class="num">${paidCount(s.code)}</td><td><span class="badge ${s.active === false ? 'draft' : 'ready'}">${s.active === false ? 'Nonaktif' : 'Aktif'}</span></td>` +
          `<td><div class="row-actions"><button class="btn small" type="button" data-edit="${escapeHtml(s.code)}">Ubah</button>` +
          `<button class="btn small" type="button" data-toggle="${escapeHtml(s.code)}">${s.active === false ? 'Aktifkan' : 'Nonaktifkan'}</button></div></td></tr>`,
      )
      .join('');
    const empty = $('salesEmpty');
    empty.hidden = list.length > 0;
    empty.textContent = App.sales.length ? 'Tidak ada sales yang cocok.' : 'Belum ada sales. Isi form di atas untuk menambah sales pertama.';
  }

  function renderData() {
    const c = App.catalog;
    $('d-store').textContent = `${App.store.label} · ${App.notas.length} nota`;
    $('d-catalog').textContent =
      c.state === 'loading' ? 'Memuat...' : c.state === 'error' ? `Gagal dimuat: ${c.errors.join(' | ')}` : `${fmtNum(c.meta.count)} barang dari server Cek Harga & Stok`;
    $('s-kasir').value = Settings.kasir;
  }

  async function saveSales() {
    const code = $('sl-code').value.trim().toUpperCase();
    const name = $('sl-name').value.trim();
    const phone = $('sl-phone').value.trim();
    const errs = [];
    if (!code) errs.push('Kode sales wajib diisi.');
    else if (/\s/.test(code)) errs.push('Kode sales tidak boleh memakai spasi.');
    else if (editing === null && App.sales.some((s) => s.code === code)) errs.push(`Kode ${code} sudah dipakai.`);
    if (!name) errs.push('Nama sales wajib diisi.');
    if (phone && !waNumber(phone)) errs.push('No. WhatsApp tidak valid. Contoh: 0812-5541-0982.');
    showError(errs);
    if (errs.length) return;
    const rec = { code, name, phone, branch: $('sl-branch').value.trim(), active: $('sl-active').checked };
    const next = editing === null ? App.sales.concat(rec) : App.sales.map((s) => (s.code === editing ? rec : s));
    const r = await App.store.saveSales(next);
    if (!r.ok) return showError([`Gagal menyimpan: ${r.message}`]);
    App.sales = next;
    App.emit('data');
    toast(editing === null ? `Sales ${code} ditambahkan.` : `Sales ${code} diperbarui.`);
    resetForm();
  }

  async function toggleSales(code) {
    const next = App.sales.map((s) => (s.code === code ? Object.assign({}, s, { active: s.active === false }) : s));
    const r = await App.store.saveSales(next);
    if (!r.ok) return toast(`Gagal menyimpan: ${r.message}`, true);
    App.sales = next;
    App.emit('data');
  }

  function bind() {
    $('btnKasir').addEventListener('click', () => {
      Settings.kasir = $('s-kasir').value;
      toast(Settings.kasir ? `Kasir diatur: ${Settings.kasir}` : 'Nama kasir dikosongkan.');
    });
    $('btnSalesSave').addEventListener('click', saveSales);
    $('btnSalesReset').addEventListener('click', resetForm);
    $('sl-q').addEventListener('input', renderSales);
    $('sl-filter').addEventListener('change', renderSales);
    $('salesBody').addEventListener('click', (e) => {
      const ed = e.target.closest('[data-edit]');
      const tg = e.target.closest('[data-toggle]');
      if (ed) fillForm(App.sales.find((s) => s.code === ed.dataset.edit));
      else if (tg) toggleSales(tg.dataset.toggle);
    });
    $('btnReload').addEventListener('click', () => App.loadCatalog());
    $('btnBackup').addEventListener('click', () => {
      const body = JSON.stringify({ exportedAt: new Date().toISOString(), sales: App.sales, notas: App.notas }, null, 2);
      downloadBlob(new Blob([body], { type: 'application/json' }), `cadangan-142nota-${dayKey(new Date())}.json`);
    });
    App.on('data', () => {
      if (!$('view-pengaturan').hidden) {
        renderSales();
        renderData();
      }
    });
    App.on('catalog', () => {
      if (!$('view-pengaturan').hidden) renderData();
    });
  }

  App.views.pengaturan = {
    init: bind,
    show() {
      renderSales();
      renderData();
    },
  };
})();
