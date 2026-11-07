(function () {
  const client = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

  // window.NOTA_TEST_FETCH dipakai uji otomatis (tests/e2e.mjs) untuk menyuntik data tanpa jaringan.
  App.fetcher =
    window.NOTA_TEST_FETCH ||
    (client ? supabaseFetcher(client) : async () => ({ ok: false, payload: null, message: 'supabase-js tidak termuat' }));

  App.store = STORE_BACKEND === 'supabase' && client ? createSupabaseStore(client) : createLocalStore();
  if (STORE_BACKEND === 'supabase' && !client) toast('Supabase tidak termuat, nota disimpan di perangkat ini.', true);

  Object.keys(App.views).forEach((k) => App.views[k].init());
  window.addEventListener('hashchange', App.route);

  App.loadData().then(() => {
    App.refreshStatus();
    App.route();
  });
  App.loadCatalog();
})();
