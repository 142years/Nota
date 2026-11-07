// Data uji sintetis berbentuk sama dengan payload app_data. Bukan data toko.
const raw = {
  inventory: {
    updatedAt: '2026-11-05T07:00:00Z',
    items: [
      {
        code: 'GAD.OPO.HP00123', desc: 'OPPO A7 PRO 5G 6/256GB BLUE', snOthers: null,
        ownUnits: [
          { serial: '111111111111111111111111', whcode: 'SDNC.UTM', admissionDate: '02/11/2026', ts: 20, status: 'Allocated' },
          { serial: '222222222222222222222222', whcode: 'SDNC.UTM', admissionDate: '03/11/2026', ts: 30, status: 'Available' },
          { serial: '333333333333333333333333', whcode: 'SDNC.SHO', admissionDate: '01/11/2026', ts: 10, status: 'Available' },
          { serial: '444444444444444444444444', whcode: 'SDNC.DEM', admissionDate: '01/10/2026', ts: 1, status: 'Available' },
        ],
      },
      { code: 'ACC.ANK.CH00001', desc: 'ANKER CHARGER 30W NANO', snOthers: { 'BJM.A': 3 }, ownUnits: null },
      { code: 'GAD.SAM.HP00999', desc: 'SAMSUNG GALAXY TAB A9', snOthers: { 'BJM.A': 1 }, ownUnits: null },
      { code: 'ACC.XXX.GL00001', desc: 'TEMPERED GLASS', snOthers: null, ownUnits: null },
    ],
  },
  stockavail: {
    own: { 'GAD.OPO.HP00123': { a: 3, l: 1 }, 'ACC.ANK.CH00001': { a: 0, l: 0 } },
    ownx: { 'ACC.XXX.GL00001': { 'SDNC.XYZ': 2 } },
    map: { 'ACC.ANK.CH00001': { 'BJM.A': 3, 'SDNX.STR': 5 }, 'GAD.NEW.HP00777': { 'BJM.B': 2 }, 'GAD.GONE.HP00001': {} },
    descMap: { 'GAD.NEW.HP00777': 'PRODUK DARI CABANG', 'GAD.GONE.HP00001': 'PRODUK KOSONG' },
    meta: { updatedAt: '2026-11-06T01:00:00Z' },
  },
  rebornprice: { byCode: { 'GAD.OPO.HP00123': 7999000, 'ACC.ANK.CH00001': 240000 } },
  barcode: { map: { 'GAD.OPO.HP00123': ['8801234567890'], 'ACC.ANK.CH00001': '699111 222333' } },
};
module.exports = raw;
