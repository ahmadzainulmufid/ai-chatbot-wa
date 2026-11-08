const cfg = require('./config');

const sesi = new Map();

function ambil(id) {
  const sekarang = Date.now();
  let s = sesi.get(id);
  if (!s || sekarang - s.terakhir > cfg.SESSION_TIMEOUT_MENIT * 60000) {
    s = { mode: null, jenisFaskes: 'semua', history: [], profil: {}, keluhan: [], baru: true, terakhir: sekarang };
    sesi.set(id, s);
  }
  s.terakhir = sekarang;
  return s;
}

function tambahRiwayat(s, role, content) {
  s.history.push({ role, content });
  if (s.history.length > cfg.MAX_HISTORY) s.history.splice(0, s.history.length - cfg.MAX_HISTORY);
  while (s.history.length && s.history[0].role !== 'user') s.history.shift();
}

function reset(s) {
  s.mode = null;
  s.jenisFaskes = 'semua';
  s.history = [];
  s.profil = {};
  s.keluhan = [];
  s.lokasi = null;
  s.pertanyaan = null;
  s.skriningAlergi = false;
  s.asesmen = {};
  s.lanjutan = null;
}

setInterval(() => {
  for (const [id, s] of sesi) {
    if (Date.now() - s.terakhir > cfg.SESSION_TIMEOUT_MENIT * 60000) sesi.delete(id);
  }
}, 60000).unref();

module.exports = { ambil, tambahRiwayat, reset };
