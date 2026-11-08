const sesiStore = require('./session');
const { tanyaAI } = require('./ai');
const { BASIS } = require('./fallback');
const faskes = require('./faskes');
const P = require('./pesan');
const K = require('./konsultasi');
const asesmen = require('./asesmen');
const mutu = require('./mutu');
const antrean = new Map();

const PILIHAN_MODE = {
  '1': { mode: 'konsultasi', teks: '🩺 *Konsultasi Kesehatan*\n\nSilakan ceritakan keluhan Anda: apa yang dirasakan, sejak kapan, dan usia Anda.\nContoh: _"Saya demam sejak kemarin, badan pegal, usia 21 tahun."_' },
  '2': { mode: 'solusi', teks: '💡 *Rekomendasi Solusi*\n\nSebutkan keluhan Anda, saya berikan saran penanganan awal yang bisa dilakukan sekarang dan kapan perlu ke dokter.\nContoh: _"sakit maag kambuh"_' },
};

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
  if (/^(5|ringkasan|selesai)$/i.test(teks)) return [K.ringkasan(s)];
  if (/^(6|privasi|tentang|bantuan)$/i.test(teks)) return [P.TENTANG];

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

  if (PILIHAN_MODE[teks]) {
    s.mode = PILIHAN_MODE[teks].mode;
    s.pertanyaan = null;
    s.lanjutan = null;
    return [PILIHAN_MODE[teks].teks];
  }
  if (teks === '3') {
    s.mode = 'faskes';
    s.pertanyaan = null;
    if (s.jenisFaskes !== 'rs') s.jenisFaskes = 'semua';
    return [P.MINTA_LOKASI(s.jenisFaskes === 'rs' ? 'rumah sakit' : 'semua')];
  }
  if (teks === '4') { s.jenisFaskes = 'rs'; return [P.DARURAT]; }

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

  const ai = await tanyaAI(s.history, teks, s.mode, asesmen.konteks(s));
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

  const masalah = mutu.periksa(ai.reply, s);
  if (masalah.length || ['konsultasi', 'solusi'].includes(ai.intent)) {
    if (masalah.length) {
      console.warn('[Mutu] Respons diganti panduan umum:', masalah.join(', '));
      ai.intent = 'konsultasi';
      ai.reply = K.cadangan(s, pertanyaan, true);
    } else {
      ai.reply = mutu.susun(ai.reply, pertanyaan);
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
