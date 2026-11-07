// Dua backend dengan antarmuka sama: { kind, label, listNotas, saveNota, listSales, saveSales }.
// Semua method mengembalikan { ok, data?, message?, conflict? } dan tidak pernah melempar.

function lsRead(key, fallback) {
  try {
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : fallback;
  } catch (e) {
    return fallback;
  }
}
function lsWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

function createLocalStore() {
  const NOTA_KEY = 'nota142:notas';
  const SALES_KEY = 'nota142:sales';
  return {
    kind: 'local',
    label: 'Disimpan di perangkat ini',
    async listNotas() {
      return { ok: true, data: lsRead(NOTA_KEY, []) };
    },
    async saveNota(nota) {
      const all = lsRead(NOTA_KEY, []);
      if (all.some((n) => n.no && n.no === nota.no && n.id !== nota.id)) return { ok: false, conflict: true, message: 'Nomor nota sudah dipakai.' };
      const i = all.findIndex((n) => n.id === nota.id);
      if (i >= 0) all[i] = nota;
      else all.push(nota);
      return lsWrite(NOTA_KEY, all) ? { ok: true } : { ok: false, message: 'Penyimpanan perangkat penuh atau diblokir browser.' };
    },
    async listSales() {
      return { ok: true, data: lsRead(SALES_KEY, []) };
    },
    async saveSales(list) {
      return lsWrite(SALES_KEY, list) ? { ok: true } : { ok: false, message: 'Penyimpanan perangkat penuh atau diblokir browser.' };
    },
  };
}

function createSupabaseStore(client) {
  const fail = (e) => ({ ok: false, message: (e && e.message) || String(e), conflict: !!(e && e.code === '23505') });
  return {
    kind: 'supabase',
    label: 'Disimpan di Supabase',
    async listNotas() {
      try {
        const { data, error } = await client.from('nota').select('data').order('created_at', { ascending: false }).limit(2000);
        if (error) return fail(error);
        return { ok: true, data: data.map((r) => r.data) };
      } catch (e) {
        return fail(e);
      }
    },
    async saveNota(nota) {
      try {
        const row = { id: nota.id, no: nota.no, status: nota.status, created_at: nota.createdAt, data: nota };
        const { error } = await client.from('nota').upsert(row, { onConflict: 'id' });
        return error ? fail(error) : { ok: true };
      } catch (e) {
        return fail(e);
      }
    },
    async listSales() {
      try {
        const { data, error } = await client.from('sales_users').select('data').order('code');
        if (error) return fail(error);
        return { ok: true, data: data.map((r) => r.data) };
      } catch (e) {
        return fail(e);
      }
    },
    async saveSales(list) {
      try {
        const rows = list.map((s) => ({ code: s.code, data: s }));
        if (!rows.length) return { ok: true };
        const { error } = await client.from('sales_users').upsert(rows, { onConflict: 'code' });
        return error ? fail(error) : { ok: true };
      } catch (e) {
        return fail(e);
      }
    },
  };
}

// Pengaturan terminal selalu per perangkat: nama kasir di kop nota bisa berbeda tiap meja.
const Settings = {
  get kasir() {
    return lsRead('nota142:kasir', '');
  },
  set kasir(v) {
    lsWrite('nota142:kasir', String(v || '').trim());
  },
};

if (typeof module !== 'undefined') module.exports = { createLocalStore, createSupabaseStore };
