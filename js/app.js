const App = {
  products: [],
  productByCode: new Map(),
  catalog: { state: 'loading', errors: [], meta: null },
  store: null,
  sales: [],
  notas: [],
  nota: null,
  views: {},
  _subs: {},
  fetcher: null,
};

const $ = (id) => document.getElementById(id);

App.on = (name, fn) => ((App._subs[name] = App._subs[name] || []).push(fn));
App.emit = (name, arg) => (App._subs[name] || []).forEach((fn) => fn(arg));

function toast(msg, bad) {
  const el = document.createElement('div');
  el.className = 'toast' + (bad ? ' bad' : '');
  el.textContent = msg;
  const box = $('toasts');
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.remove(), bad ? 6000 : 3500);
}

function parseMoney(s) {
  return parseInt(String(s).replace(/\D/g, ''), 10) || 0;
}

const ROUTES = { buat: 'Buat Nota', riwayat: 'Riwayat Nota', pengaturan: 'Pengaturan' };

App.route = function () {
  const name = ROUTES[location.hash.slice(1)] ? location.hash.slice(1) : 'buat';
  Object.keys(ROUTES).forEach((r) => {
    $('view-' + r).hidden = r !== name;
    const link = document.querySelector(`.nav a[data-route="${r}"]`);
    if (r === name) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.title = `${ROUTES[name]} · 142Nota`;
  if (App.views[name]) App.views[name].show();
};

App.refreshStatus = function () {
  const c = App.catalog;
  const el = $('catStatus');
  el.classList.toggle('bad', c.state === 'error');
  if (c.state === 'loading') el.textContent = 'Memuat katalog...';
  else if (c.state === 'error') el.textContent = 'Katalog gagal dimuat';
  else if (c.meta && c.meta.noInventory) el.textContent = 'Katalog kosong di server';
  else {
    const when = c.meta.updatedAt ? new Date(c.meta.updatedAt) : null;
    const stamp = when && !isNaN(when) ? ` · ${fmtDate(when)} ${fmtTime(when)}` : '';
    el.textContent = `Katalog ${fmtNum(c.meta.count)} barang${stamp}`;
  }
  $('storeStatus').textContent = App.store ? App.store.label : '';
};

App.loadCatalog = async function () {
  App.catalog = { state: 'loading', errors: [], meta: null };
  App.refreshStatus();
  App.emit('catalog');
  try {
    const r = await loadCatalogData(App.fetcher);
    App.products = r.products;
    App.productByCode = new Map(r.products.map((p) => [p.code, p]));
    const allFailed = r.errors.length === CATALOG_KEYS.length;
    App.catalog = { state: allFailed ? 'error' : 'ok', errors: r.errors, meta: r.meta };
  } catch (e) {
    App.catalog = { state: 'error', errors: [e.message || String(e)], meta: null };
  }
  App.refreshStatus();
  App.emit('catalog');
};

App.loadData = async function () {
  const [n, s] = await Promise.all([App.store.listNotas(), App.store.listSales()]);
  if (!n.ok) toast(`Gagal membaca nota: ${n.message}`, true);
  if (!s.ok) toast(`Gagal membaca daftar sales: ${s.message}`, true);
  App.notas = n.ok ? n.data : App.notas;
  App.sales = s.ok ? s.data : App.sales;
  App.emit('data');
};

App.salesName = (code) => {
  const s = App.sales.find((x) => x.code === code);
  return s ? s.name : '';
};
