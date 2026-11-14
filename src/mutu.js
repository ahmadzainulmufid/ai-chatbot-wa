const sesiStore = require('./session');
const { tanyaAI } = require('./ai');
const { BASIS } = require('./fallback');
const faskes = require('./faskes');
const P = require('./pesan');
const K = require('./konsultasi');
const asesmen = require('./asesmen');
const mutu = require('./mutu');
const udara = require('./udara');
const fs = require('fs');
const path = require('path');
const antrean = new Map();

// Isi "Tentang #SELARAS" dibaca dari konten/selaras.txt agar mudah diedit tanpa mengubah kode.
function tentangSelaras() {
  try {
    const isi = fs.readFileSync(path.join(__dirname, '..', 'konten', 'selaras.txt'), 'utf8').trim();
    if (isi) return isi;
  } catch { /* pakai teks bawaan */ }
  return '🌿 *Tentang #SELARAS*\n\nRara adalah Virtual Assistant #SELARAS yang membantu info kualitas udara, kesehatan pernapasan, dan tips hidup sehat.';
}

const KATA_LOKASI = /\b(tolong|saya|mau|cek|cari|carikan|info|bagaimana|gimana|kualitas|udara|polusi|aqi|ispu|indeks|hari ini|sekarang|terdekat|di|dekat|daerah|sekitar|wilayah|kota)\b/gi;

async function jalankanCekUdara(s, lat, lon, namaLokasi, dariGps = false) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return ['Koordinat tidak valid. Kirim ulang lokasi melalui WhatsApp.'];
  }
  s.lokasi = { lat, lon, namaLokasi, dariGps };
  try {
    const data = await udara.cekUdara(lat, lon);
    return [udara.formatUdara(data, namaLokasi)];
  } catch (err) {
    console.error('[Udara] Gagal:', err.name === 'TimeoutError' ? 'timeout ke Open-Meteo' : err.message);
    return ['Maaf, data kualitas udara sedang tidak dapat diambil. 🙏 Coba lagi beberapa saat lagi, atau cek aplikasi/kanal resmi pemantau kualitas udara di daerah Anda.'];
  }
}

async function cekUdaraDariTeks(s, teks) {
  s.mode = 'udara';
  s.pertanyaan = null;
  const alamat = teks.replace(KATA_LOKASI, ' ').replace(/[?!.,]/g, ' ').replace(/\s+/g, ' ').trim();
  if (alamat.length >= 3) {
    try {
      const titik = await faskes.geocode(alamat);
      if (!titik) return [`Maaf, lokasi "${alamat}" tidak ditemukan. Coba tulis lebih lengkap (kecamatan + kota) atau kirim lokasi lewat 📎 → Lokasi.`];
      return jalankanCekUdara(s, titik.lat, titik.lon, titik.nama);
    } catch (err) {
      console.error('[Geocode] Gagal:', err.message);
      return ['Maaf, pencarian alamat sedang bermasalah. Silakan kirim lokasi lewat 📎 → *Lokasi* saja ya.'];
    }
  }
  if (s.lokasi) return jalankanCekUdara(s, s.lokasi.lat, s.lokasi.lon, s.lokasi.namaLokasi, s.lokasi.dariGps);
  return [P.MINTA_LOKASI_UDARA];
}

const JENIS_SAJA = /^(apotek|apotik|puskesmas|klinik|rs|rumah sakit|semua)$/i;

async function jalankanCariFaskes(s, lat, lon, namaLokasi, dariGps = false) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return ['Koordinat tidak valid. Kirim ulang lokasi melalui WhatsApp.'];
  }
  s.lokasi = { lat, lon, namaLokasi, dariGps };
  if (s.kirimSementara) {
    try { await s.kirimSementara('🔎 Sedang mencari faskes terdekat, mohon tunggu sebentar...'); } catch {}
  }
  try {
    const hasil = await faskes.cariFaskes(lat, lon, s.jenisFaskes);
    return [faskes.formatHasil(hasil, s.jenisFaskes, namaLokasi, lat, lon, dariGps),
      'Ada lagi yang bisa dibantu? Ketik *menu* untuk kembali, atau ceritakan keluhan Anda.'];
  } catch (err) {
    console.error('[Faskes] Gagal:', err.message);
    // Tetap beri link Google Maps di sekitar lokasi pengguna
    return [faskes.formatHasil({ hasil: [], radius: 0 }, s.jenisFaskes, namaLokasi, lat, lon, dariGps),
      'Ada lagi yang bisa dibantu? Ketik *menu* untuk kembali, atau ceritakan keluhan Anda.'];
  }
}

async function cariDariAlamat(s, alamat) {
  try {
    const titik = await faskes.geocode(alamat);
    if (!titik) {
      return [`Maaf, lokasi "${alamat}" tidak ditemukan. Coba tulis lebih lengkap (kelurahan/kecamatan + kota) atau kirim lokasi lewat 📎 → Lokasi.`];
    }
    return jalankanCariFaskes(s, titik.lat, titik.lon, titik.nama);
  } catch (err) {
    console.error('[Geocode] Gagal:', err.message);
    return ['Maaf, pencarian alamat sedang bermasalah. Silakan kirim lokasi lewat 📎 → *Lokasi* saja ya.'];
  }
}

/**
 * @param {string} id     nomor pengirim
 * @param {object} input  { teks?: string, lokasi?: {lat, lon, nama?} }
 * @param {function} [kirimSementara] fungsi untuk mengirim pesan sementara (opsional)
 * @returns {Promise<string[]>} daftar pesan balasan
 */
async function proses(id, input, kirimSementara) {
  const s = sesiStore.ambil(id);
  s.kirimSementara = kirimSementara; 

  if (input.lokasi) {
    s.baru = false;
    if (s.mode === 'udara') return jalankanCekUdara(s, input.lokasi.lat, input.lokasi.lon, input.lokasi.nama, true);
    s.mode = 'faskes';
    return jalankanCariFaskes(s, input.lokasi.lat, input.lokasi.lon, input.lokasi.nama, true);
  }

  const teks = (input.teks || '').trim();
  if (!teks) return [];
  if (teks.length > 4000) return ['Pesan terlalu panjang. Kirim keluhan dalam beberapa pesan singkat (maksimal 4.000 karakter per pesan).'];

  if (/^(hapus data|reset|keluhan baru)$/i.test(teks)) {
    sesiStore.reset(s);
    s.baru = false;
    return ['Sesi bot telah dihapus. Pesan di WhatsApp dan data pada penyedia layanan tidak ikut terhapus.\n\nSaya Rara. Ceritakan keluhan baru, sejak kapan, dan usia Anda.'];
  }

  if (P.RE_KRISIS.test(teks)) { s.baru = false; return [P.KRISIS_JIWA]; }
  const afirmasiBahaya = s.lanjutan === 'alergi' &&
    (/^(iya|ya|ada|betul|benar)(?:\s+(?:ada|rara|kak))?[.!]*$/i.test(teks) || /\bsesak\b|sulit menelan/i.test(asesmen.keluhanAktif(teks)));
  if (K.darurat(teks) || afirmasiBahaya) { s.baru = false; s.jenisFaskes = 'rs'; s.mode = 'darurat'; return [P.DARURAT]; }
  if (/^(2|ringkasan|ringkasan kesehatan|selesai)$/i.test(teks)) return [K.ringkasan(s)];
  if (/^(privasi|bantuan)$/i.test(teks)) return [P.TENTANG];

  if ((P.RE_SAPA.test(teks) && teks.length <= 30) || teks === '0') {
    const pertama = s.baru;
    s.baru = false;
    s.mode = null;
    s.pertanyaan = null;
    s.lanjutan = null;
    return [pertama ? P.SAPAAN : P.MENU];
  }
  if (P.adalahPenutup(teks)) {
    s.baru = false;
    s.mode = null;
    s.pertanyaan = null;
    s.lanjutan = null;
    return [`Sama-sama, Kak! 🌿 Semoga lekas pulih. Kalau membutuhkan bantuan lagi, Rara siap menemani.\n\n${P.MENU}`];
  }
  if (s.baru) {
    s.baru = false;
    // Pesan pertama langsung berisi keluhan → tetap diproses, tidak dipaksa lewat menu
  }

  // ===== Menu (sama dengan urutan polling) =====
  if (/^(1|konsultasi|konsultasi kesehatan|pernapasan|kesehatan pernapasan)$/i.test(teks)) {
    s.mode = 'konsultasi';
    s.pertanyaan = null;
    s.lanjutan = null;
    return [P.KONSULTASI];
  }
  if (/^(3|cari klinik|cari apotek|cari faskes|cari klinik \/ apotek)$/i.test(teks)) {
    s.mode = 'faskes';
    s.pertanyaan = null;
    if (s.jenisFaskes !== 'rs') s.jenisFaskes = 'semua';
    return [P.MINTA_LOKASI(s.jenisFaskes === 'rs' ? 'rumah sakit' : 'semua')];
  }
  if (/^(4|darurat|nomor darurat)$/i.test(teks)) { s.jenisFaskes = 'rs'; return [P.DARURAT]; }
  if (/^(5|udara|udara saat ini|cek udara)$/i.test(teks)) return cekUdaraDariTeks(s, '');
  if (/^(6|about|about me|tentang|tentang rara|tentang selaras|selaras|#selaras)$/i.test(teks)) { s.mode = null; s.pertanyaan = null; return [tentangSelaras()]; }
  if (/^(7|tips|tips hidup sehat|tips sehat)$/i.test(teks)) { s.pertanyaan = null; return [P.TIPS]; }

  // Pertanyaan kualitas udara langsung, mis. "kualitas udara di Depok"
  if (P.RE_UDARA.test(teks) && teks.length <= 80) return cekUdaraDariTeks(s, teks);
  // Sedang di menu udara → teks pendek dianggap nama daerah
  if (s.mode === 'udara' && teks.length <= 60 && !BASIS.some((b) => b.kunci.test(teks))) return cekUdaraDariTeks(s, teks);
  if (s.mode === 'udara') s.mode = 'konsultasi';

  const jenisEksplisit = P.deteksiJenisFaskes(teks);
  if (jenisEksplisit && (JENIS_SAJA.test(teks) || /\b(cari|carikan|terdekat|sekitar)\b/i.test(teks))) {
    s.mode = 'faskes';
    s.pertanyaan = null;
    s.jenisFaskes = jenisEksplisit;
    const alamat = teks.replace(/\b(tolong|saya|mau|cari|carikan|apotek|apotik|puskesmas|klinik|rumah sakit|rs|terdekat|di|dekat|daerah|sekitar)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    if (alamat.length >= 3) return cariDariAlamat(s, alamat);
    if (s.lokasi) {
      const l = s.lokasi;
      return jalankanCariFaskes(s, l.lat, l.lon, l.namaLokasi, l.dariGps);
    }
    return [P.MINTA_LOKASI(faskes.LABEL[jenisEksplisit].toLowerCase())];
  }

  if (s.mode === 'faskes') {
    const jenis = P.deteksiJenisFaskes(teks);
    if (JENIS_SAJA.test(teks)) {
      s.jenisFaskes = /semua/i.test(teks) ? 'semua' : jenis;
      return [`Oke, saya carikan *${s.jenisFaskes === 'semua' ? 'semua faskes' : faskes.LABEL[s.jenisFaskes]}*. Silakan kirim lokasi (📎 → Lokasi) atau ketik nama daerah Anda.`];
    }
    const terlihatKeluhan = BASIS.some((b) => b.kunci.test(teks));
    if (!terlihatKeluhan && teks.length <= 80) {
      if (jenis) s.jenisFaskes = jenis;
      const alamat = teks.replace(/\b(cari|carikan|apotek|apotik|puskesmas|klinik|rumah sakit|rs|terdekat|di|dekat|daerah|sekitar)\b/gi, ' ').replace(/\s+/g, ' ').trim();
      if (alamat.length >= 3) return cariDariAlamat(s, alamat);
      return [P.MINTA_LOKASI(s.jenisFaskes === 'semua' ? 'semua' : faskes.LABEL[s.jenisFaskes].toLowerCase())];
    }
    s.mode = 'konsultasi'; 
  }

  K.catat(s, teks);
  const pertanyaan = asesmen.berikutnya(s);

  const tahap = pertanyaan ? 'menggali' : 'rekomendasi';
  const ai = await tanyaAI(s.history, teks, s.mode, { ...asesmen.konteks(s), tahap });
  sesiStore.tambahRiwayat(s, 'user', teks);

  if (!ai) {
    // Mode cadangan tanpa AI
    const jenis = P.deteksiJenisFaskes(teks);
    if (jenis || /terdekat|cari (klinik|apotek|puskesmas)/i.test(teks)) {
      s.mode = 'faskes';
      s.jenisFaskes = jenis || 'semua';
      return [P.MINTA_LOKASI(s.jenisFaskes === 'semua' ? 'semua' : faskes.LABEL[s.jenisFaskes].toLowerCase())];
    }
    s.mode = 'konsultasi';
    const balas = K.cadangan(s, pertanyaan);
    sesiStore.tambahRiwayat(s, 'assistant', balas);
    return [balas];
  }

  // Periksa semua teks yang akan dikirim, termasuk bagian terstruktur.
  const rinci = tahap === 'rekomendasi'
    ? { penyebab: ai.penyebab, anjuran: ai.anjuran, ke_dokter: ai.ke_dokter, tanda_bahaya: ai.tanda_bahaya }
    : null;
  const semuaTeks = [ai.reply, rinci?.penyebab, ...(rinci?.anjuran || []), rinci?.ke_dokter, ...(rinci?.tanda_bahaya || [])]
    .filter(Boolean).join('\n');
  const masalah = mutu.periksa(semuaTeks, s);
  if (masalah.length || ['konsultasi', 'solusi'].includes(ai.intent)) {
    if (masalah.length) {
      console.warn('[Mutu] Respons diganti panduan umum:', masalah.join(', '));
      ai.intent = 'konsultasi';
      ai.reply = K.cadangan(s, pertanyaan, true);
    } else {
      ai.reply = mutu.susun(ai.reply, pertanyaan, rinci, s);
    }
  }
  sesiStore.tambahRiwayat(s, 'assistant', ai.reply);

  switch (ai.intent) {
    case 'darurat':
      s.mode = 'darurat';
      s.jenisFaskes = 'rs';
      return [ai.reply, P.DARURAT];
    case 'menu':
      return [ai.reply, P.MENU];
    case 'udara':
      return [ai.reply, ...(await cekUdaraDariTeks(s, ai.lokasi_teks || ''))];
    case 'faskes': {
      s.mode = 'faskes';
      s.jenisFaskes = ['apotek', 'puskesmas', 'klinik', 'rs'].includes(ai.jenis_faskes) ? ai.jenis_faskes : 'semua';
      if (ai.lokasi_teks) {
        const hasil = await cariDariAlamat(s, ai.lokasi_teks);
        return [ai.reply, ...hasil];
      }
      return [P.MINTA_LOKASI(s.jenisFaskes === 'semua' ? 'semua' : faskes.LABEL[s.jenisFaskes].toLowerCase())];
    }
    default:
      if (ai.intent === 'konsultasi' || ai.intent === 'solusi') s.mode = s.mode || ai.intent;
      return [ai.reply];
  }
}

function handle(id, input, kirimSementara) {
  const sebelumnya = antrean.get(id) || Promise.resolve();
  const tugas = sebelumnya.catch(() => {}).then(() => proses(id, input, kirimSementara));
  antrean.set(id, tugas);
  const bersihkan = () => { if (antrean.get(id) === tugas) antrean.delete(id); };
  tugas.then(bersihkan, bersihkan);
  return tugas;
}

module.exports = { handle };