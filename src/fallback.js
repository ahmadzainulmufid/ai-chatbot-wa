// Panduan umum dipakai bila AI tidak tersedia. Isi bersifat perawatan awal yang aman,
// dipisah antara kapan perlu ke dokter (periksa) dan kapan harus segera ke IGD (igd).
const BASIS = [
  {
    kunci: /demam|panas badan|meriang|suhu tinggi/i,
    judul: 'Demam',
    saran: ['Istirahat cukup dan perbanyak minum air putih', 'Kompres hangat di dahi/ketiak, pakai baju tipis',
      'Ukur suhu secara berkala bila ada termometer',
      'Bila membutuhkan obat, minta apoteker/dokter memeriksa kesesuaiannya dengan kondisi dan obat lain Anda'],
    periksa: 'demam lebih dari 3 hari, suhu ≥ 39°C, muncul bintik merah, atau muntah terus sehingga sulit minum.',
    igd: ['Kejang atau kesadaran menurun/linglung', 'Sesak napas', 'Mimisan, gusi berdarah, atau BAB hitam',
      'Sangat lemas dan jarang buang air kecil', 'Demam pada bayi di bawah 3 bulan'],
  },
  {
    kunci: /batuk|pilek|flu|hidung tersumbat|bersin|tenggorokan|radang/i,
    judul: 'Batuk / Pilek',
    saran: ['Minum cukup, madu hanya untuk usia di atas 1 tahun', 'Hindari asap rokok dan uap air panas yang berisiko menyebabkan luka bakar',
      'Pakai masker agar tidak menular, istirahat cukup', 'Bilas hidung dengan cairan garam steril bila hidung tersumbat'],
    periksa: 'batuk lebih dari 2 minggu, demam tinggi lebih dari 3 hari, atau nyeri telinga/wajah yang mengganggu.',
    igd: ['Sesak napas atau napas berbunyi', 'Bibir atau ujung jari kebiruan', 'Batuk berdarah', 'Nyeri dada saat bernapas'],
  },
  {
    kunci: /sakit kepala|pusing|migrain|kepala (sakit|nyut)/i,
    judul: 'Sakit Kepala',
    saran: ['Istirahat di ruangan tenang dan redup', 'Cukupi minum, jangan telat makan',
      'Kurangi layar HP/laptop sementara', 'Konsultasikan pilihan obat dengan apoteker/dokter jika diperlukan'],
    periksa: 'sakit kepala baru yang menetap lebih dari 3 hari, sering kambuh, atau tidak membaik dengan istirahat.',
    igd: ['Sakit kepala sangat hebat yang muncul tiba-tiba', 'Kaku leher disertai demam', 'Lemah/kesemutan satu sisi tubuh atau bicara pelo',
      'Pandangan kabur/ganda atau muntah menyembur', 'Terjadi setelah benturan di kepala'],
  },
  {
    kunci: /diare|mencret|buang air (besar )?terus|bab cair/i,
    judul: 'Diare',
    saran: ['Minum oralit sedikit-sedikit tapi sering untuk cegah dehidrasi', 'Makan makanan lunak (bubur, pisang)',
      'Hindari pedas, bersantan, susu, dan kopi sementara', 'Cuci tangan pakai sabun'],
    periksa: 'diare lebih dari 2 hari, disertai demam tinggi, atau nyeri perut yang mengganggu.',
    igd: ['BAB berdarah atau hitam', 'Sangat lemas, mata cekung, jarang buang air kecil', 'Muntah terus sehingga tidak bisa minum',
      'Nyeri perut hebat'],
  },
  {
    kunci: /maag|lambung|perut (perih|kembung|sakit|mual)|mual|asam lambung|gerd|ulu hati/i,
    judul: 'Maag / Gangguan Lambung',
    saran: ['Makan porsi kecil tapi teratur, jangan telat makan', 'Hindari pedas, asam, kopi, dan rokok',
      'Jangan langsung berbaring setelah makan', 'Tanyakan pilihan obat kepada apoteker/dokter bila diperlukan'],
    periksa: 'keluhan sering kambuh atau lebih dari 2 minggu, sulit menelan, atau berat badan turun tanpa sebab.',
    igd: ['Muntah darah atau seperti ampas kopi', 'BAB hitam', 'Nyeri perut hebat mendadak atau perut terasa keras',
      'Nyeri ulu hati menjalar ke dada, lengan, atau rahang'],
  },
  {
    kunci: /sakit gigi|gigi (sakit|ngilu|berlubang)|gusi bengkak/i,
    judul: 'Sakit Gigi',
    saran: ['Kumur air garam hangat', 'Kompres dingin di pipi bagian luar', 'Sikat gigi pelan, hindari makanan terlalu panas/dingin/manis',
      'Hubungi dokter gigi untuk pemeriksaan penyebab'],
    periksa: 'nyeri tidak hilang dalam 1–2 hari, gusi bengkak, atau gigi berlubang — sebaiknya ke dokter gigi secepatnya.',
    igd: ['Bengkak meluas ke leher atau bawah rahang', 'Sulit menelan atau bernapas', 'Demam tinggi dengan wajah bengkak'],
  },
  {
    kunci: /gatal|alergi|biduran|ruam|kulit merah|bentol/i,
    judul: 'Gatal / Alergi Kulit',
    saran: ['Jangan digaruk, kompres dingin', 'Hindari pemicu (makanan, sabun, debu) yang dicurigai',
      'Pakai pakaian longgar berbahan lembut',
      'Tanyakan pilihan obat yang sesuai kepada apoteker/dokter, terutama untuk anak, ibu hamil, atau pengguna obat lain'],
    periksa: 'ruam meluas, tidak membaik dalam 2–3 hari, atau sering kambuh.',
    igd: ['Bengkak di bibir, lidah, atau kelopak mata', 'Sesak napas atau suara serak mendadak', 'Sulit menelan',
      'Pusing berat atau terasa akan pingsan'],
  },
  {
    kunci: /susah tidur|insomnia|stres|stress|cemas|gelisah|overthinking/i,
    judul: 'Sulit Tidur / Stres',
    saran: ['Tidur & bangun di jam yang sama setiap hari', 'Hindari kopi dan HP 1 jam sebelum tidur',
      'Coba tarik napas dalam atau jalan santai di pagi hari', 'Ceritakan ke orang yang dipercaya'],
    periksa: 'keluhan lebih dari 2 minggu dan mengganggu aktivitas — konsultasikan ke psikolog/puskesmas.',
    igd: ['Muncul pikiran menyakiti diri atau mengakhiri hidup', 'Jantung berdebar hebat disertai nyeri dada atau sesak'],
  },
];

/**
 * Susun saran cadangan memakai format yang sama dengan jawaban AI.
 * @param {string} teks  keluhan (sudah dibersihkan dari gejala yang disangkal)
 * @param {object} [opsi] { pembuka, pertanyaan, s, keDokterTambahan }
 */
function balasCadangan(teks, opsi = {}) {
  const { formatRekomendasi } = require('./mutu');
  const cocok = BASIS.find((b) => b.kunci.test(teks));
  if (!cocok) {
    return 'Terima kasih sudah bercerita. 🙏 Agar saya bisa bantu lebih tepat, boleh jelaskan:\n\n' +
      '• Keluhan utama apa?\n• Sejak kapan?\n• Ada gejala lain (demam, mual, nyeri)?\n• Usia Anda berapa?\n\n' +
      'Contoh: _"Demam sejak 2 hari, badan pegal, usia 20 tahun"_';
  }
  return formatRekomendasi({
    pembuka: opsi.pembuka,
    judul: `💡 *Saran awal untuk ${cocok.judul}*`,
    anjuran: cocok.saran,
    keDokter: cocok.periksa.charAt(0).toUpperCase() + cocok.periksa.slice(1) + (opsi.keDokterTambahan || ''),
    pertanyaan: opsi.pertanyaan,
    tandaBahaya: cocok.igd,
    s: opsi.s,
  });
}

module.exports = { balasCadangan, BASIS };
