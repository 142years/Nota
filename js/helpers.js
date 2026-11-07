function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function fmtNum(n) {
  return Math.round(Number(n) || 0).toLocaleString('id-ID');
}
function fmtRupiah(n) {
  return 'Rp ' + fmtNum(n);
}
const pad2 = (n) => String(n).padStart(2, '0');
function fmtDate(d) {
  d = new Date(d);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function fmtTime(d) {
  d = new Date(d);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function dayKey(d) {
  d = new Date(d);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}
// Nomor HP Indonesia -> format wa.me (62...). Kosong bila tidak masuk akal.
function waNumber(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  return d.length >= 10 && d.startsWith('62') ? d : '';
}
function csvCell(v) {
  const s = String(v === null || v === undefined ? '' : v);
  return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

if (typeof module !== 'undefined') {
  module.exports = { escapeHtml, fmtNum, fmtRupiah, fmtDate, fmtTime, dayKey, waNumber, csvCell, pad2 };
}
