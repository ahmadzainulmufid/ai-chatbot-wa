const { BASIS, balasCadangan } = require('./fallback');

function catat(s, teks) {
  s.profil ||= {};
  s.keluhan ||= [];
  if (s.pertanyaan === 'usia' && /^\d{1,3}$/.test(teks)) s.profil.usia = `${teks} tahun`;
  const usia = teks.match(/(?:usia|umur)\s*(\d{1,3})(?:\s*(tahun|bulan))?/i);
  if (usia) s.profil.usia = `${usia[1]} ${usia[2] || 'tahun'}`;
  const durasi = [...teks.matchAll(/(?:sejak\s+|sudah\s+|selama\s+)?\d+\s*(?:hari|minggu|bulan|jam|menit)\b/gi)]
    .find(m => !/(?:usia|umur)\s*$/i.test(teks.slice(0, m.index)));
  const relatif = teks.match(/\b(?:(?:sejak|dari|mulai)\s+)?(?:kemarin(?:\s+(?:pagi|siang|sore|malam))?|tadi(?:\s+(?:pagi|siang|sore|malam))?|hari ini|barusan|semalam|sejak kecil|sejak lama)\b/i);
  if (durasi || relatif) s.profil.durasi = (durasi || relatif)[0];
  const nyeri = teks.match(/(?:nyeri|skala)\s*(\d{1,2})(?:\s*\/\s*10)?/i);
  if (nyeri && Number(nyeri[1]) <= 10) s.profil.nyeri = `${nyeri[1]}/10`;
  s.keluhan.push(teks);
  if (s.keluhan.length > 30) s.keluhan.shift();
  require('./asesmen').catat(s, teks);
}

function ringkasan(s) {
  if (!s.keluhan?.length) return 'Belum ada konsultasi. Ceritakan keluhan dan sejak kapan dirasakan kepada Rara.';
  return `📋 *Ringkasan percakapan dengan Rara*\n\n` +
    `• Usia: ${s.profil.usia || 'belum disebutkan'}\n• Durasi: ${s.profil.durasi || 'belum disebutkan'}\n• Skala nyeri: ${s.profil.nyeri || 'belum disebutkan'}\n\n` +
    Object.entries(s.asesmen || {}).map(([k, v]) => `• ${ { suhu: 'Suhu', alergi: 'Skrining alergi', gejala: 'Gejala lain', risiko: 'Riwayat/alergi obat', obat: 'Penanganan yang dicoba' }[k] || k }: ${v}\n`).join('') + '\n' +
    '*Keterangan pengguna:*\n' + s.keluhan.map(t => `• ${t}`).join('\n') +
    '\n\n_Ringkasan berdasarkan pesan pengguna, bukan diagnosis atau rekam medis dokter. Anda dapat membawanya saat pemeriksaan._';
}

function darurat(teks) {
  const klausa = teks.split(/[,;.!?\n]|\btapi\b|\btetapi\b|\bnamun\b/i);
  return klausa.some(k => {
    const bersih = k.replace(/\b(tidak|tak|nggak|gak|ga|tanpa|belum)\s+(?:ada\s+|mengalami\s+)?(?:sesak(?: napas| nafas)?|nyeri dada|sakit dada|kejang|pingsan|bengkak(?: di)? (?:bibir|lidah|tenggorokan))\b/gi, '');
    return require('./pesan').RE_DARURAT.test(bersih) ||
      /(?:bibir|lidah|tenggorokan)\s*(?:saya\s*)?(?:membengkak|bengkak)|bengkak\s*(?:di\s*)?(?:bibir|lidah|tenggorokan)|sulit (?:bernapas|bernafas)|sakit kepala (?:paling hebat|hebat mendadak)|sakit kepala mendadak (?:sangat )?hebat/i.test(bersih);
  });
}

function cadangan(s, pertanyaan, karenaMutu = false) {
  const konteks = require('./asesmen').keluhanAktif(s.keluhan.join('. '));
  const cocok = BASIS.find(b => b.kunci.test(konteks));
  const pembuka = karenaMutu ? '🌿 Rara memakai panduan umum agar informasi awal tetap berhati-hati.\n\n' : '🌿 Rara sedang memakai panduan umum karena layanan AI tidak tersedia.\n\n';
  if (!s.profil.usia) {
    s.pertanyaan = 'usia';
    return pembuka + 'Berapa usia orang yang mengalami keluhan ini? Tulis misalnya *usia 25 tahun*.\n\nJika ada sulit bernapas, bengkak bibir/lidah, penurunan kesadaran, atau nyeri dada, segera cari pertolongan darurat.';
  }
  if (!s.profil.durasi) {
    s.pertanyaan = 'durasi';
    return pembuka + 'Keluhan ini mulai sejak kapan? Apakah semakin berat atau mengganggu aktivitas?\n\nJika disertai sesak, bengkak bibir/lidah, atau hampir pingsan, segera ke IGD.';
  }
  if (cocok?.judul === 'Gatal / Alergi Kulit' && !s.asesmen?.alergi) {
    s.skriningAlergi = true;
    return pembuka + 'Apakah ada sesak, sulit menelan, bengkak bibir/lidah, atau terasa akan pingsan? Bila ada, segera ke IGD dan jangan menunggu chat.\n\nHindari makanan yang dicurigai, jangan mencoba memakannya lagi, dan kompres dingin area gatal. Untuk obat, konsultasikan dengan apoteker/dokter.';
  }
  s.pertanyaan = null;
  if (s.keluhan.length > 1 && pertanyaan) {
    return pembuka + 'Terima kasih, informasinya sudah Rara catat.\n\n' + pertanyaan;
  }
  if (/^(?:[0-9]|1[0-7])\s*tahun$|bulan/.test(s.profil.usia) || /hamil|menyusui/i.test(konteks)) {
    return pembuka + 'Untuk anak, kehamilan, atau menyusui, pilihan penanganan dan obat perlu diperiksa tenaga kesehatan. Jangan menggunakan saran obat dewasa. Hubungi dokter/apoteker dan ceritakan keluhan, durasi, serta obat yang sudah digunakan.\n\nJika ada sulit bernapas, penurunan kesadaran, atau kondisi memburuk cepat, segera ke IGD. Ketik *3* untuk mencari fasilitas kesehatan.';
  }
  const sakitKepalaMenetap = cocok?.judul === 'Sakit Kepala' && /(?:3|4|5|6|7|8|9|\d{2,})\s*hari|minggu|bulan/i.test(s.profil.durasi);
  if (!cocok) {
    return pembuka + 'Rara belum dapat memastikan penyebab keluhan dari informasi ini. Hubungi tenaga kesehatan jika keluhan memburuk atau mengganggu aktivitas.' +
      (pertanyaan ? '\n\n' + pertanyaan : '\n\n🚨 Jika sulit bernapas, nyeri dada, atau kesadaran menurun, segera ke IGD atau hubungi 119.\n\nKetik *ringkasan* untuk melihat catatan.');
  }
  return balasCadangan(konteks, {
    pembuka: pembuka.trim(),
    pertanyaan,
    s,
    keDokterTambahan: sakitKepalaMenetap
      ? ' Karena sakit kepala sudah menetap beberapa hari, hubungi dokter secepatnya, terutama jika ini keluhan baru atau semakin berat.'
      : '',
  });
}

module.exports = { catat, ringkasan, darurat, cadangan };