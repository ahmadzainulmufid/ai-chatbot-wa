const BASIS = [
  {
    kunci: /demam|panas badan|meriang|suhu tinggi/i,
    judul: 'Demam',
    saran: ['Istirahat cukup dan perbanyak minum air putih', 'Kompres hangat di dahi/ketiak, pakai baju tipis',
      'Bila membutuhkan obat, minta apoteker/dokter memeriksa kesesuaiannya dengan kondisi dan obat lain Anda'],
    bahaya: 'demam > 3 hari, suhu ≥ 39°C, muncul bintik merah, mimisan, kejang, atau terjadi pada bayi < 3 bulan',
  },
  {
    kunci: /batuk|pilek|flu|hidung tersumbat|bersin|tenggorokan|radang/i,
    judul: 'Batuk / Pilek',
    saran: ['Minum cukup, madu hanya untuk usia di atas 1 tahun', 'Hindari asap rokok dan uap air panas yang berisiko menyebabkan luka bakar',
      'Pakai masker agar tidak menular, istirahat cukup'],
    bahaya: 'batuk > 2 minggu, batuk berdarah, sesak napas, atau demam tinggi',
  },
  {
    kunci: /sakit kepala|pusing|migrain|kepala (sakit|nyut)/i,
    judul: 'Sakit Kepala',
    saran: ['Istirahat di ruangan tenang dan redup', 'Cukupi minum, jangan telat makan',
      'Konsultasikan pilihan obat dengan apoteker/dokter jika diperlukan', 'Kurangi layar HP/laptop sementara'],
    bahaya: 'sakit kepala sangat hebat tiba-tiba, disertai muntah menyembur, kaku leher, pandangan kabur, atau setelah benturan',
  },
  {
    kunci: /diare|mencret|buang air (besar )?terus|bab cair/i,
    judul: 'Diare',
    saran: ['Minum oralit sedikit-sedikit tapi sering untuk cegah dehidrasi', 'Makan makanan lunak (bubur, pisang)',
      'Hindari pedas, bersantan, susu, dan kopi sementara', 'Cuci tangan pakai sabun'],
    bahaya: 'BAB berdarah, lemas berat, jarang kencing, mata cekung, atau diare > 2 hari',
  },
  {
    kunci: /maag|lambung|perut (perih|kembung|sakit|mual)|mual|asam lambung|gerd|ulu hati/i,
    judul: 'Maag / Gangguan Lambung',
    saran: ['Makan porsi kecil tapi teratur, jangan telat makan', 'Hindari pedas, asam, kopi, dan rokok',
      'Jangan langsung berbaring setelah makan', 'Tanyakan pilihan obat kepada apoteker/dokter bila diperlukan'],
    bahaya: 'muntah darah, BAB hitam, nyeri perut hebat, atau berat badan turun drastis',
  },
  {
    kunci: /sakit gigi|gigi (sakit|ngilu|berlubang)|gusi bengkak/i,
    judul: 'Sakit Gigi',
    saran: ['Kumur air garam hangat', 'Kompres dingin di pipi bagian luar', 'Hubungi dokter gigi untuk pemeriksaan penyebab',
      'Sikat gigi pelan, hindari makanan terlalu panas/dingin/manis'],
    bahaya: 'pipi bengkak besar, demam, atau sulit membuka mulut — segera ke dokter gigi',
  },
  {
    kunci: /gatal|alergi|biduran|ruam|kulit merah|bentol/i,
    judul: 'Gatal / Alergi Kulit',
    saran: ['Jangan digaruk, kompres dingin', 'Hindari pemicu (makanan, sabun, debu) yang dicurigai',
      'Tanyakan pilihan obat yang sesuai kepada apoteker/dokter, terutama untuk anak, ibu hamil, atau pengguna obat lain'],
    bahaya: 'bengkak di bibir/mata/lidah atau sesak napas — itu reaksi alergi berat, segera ke IGD',
  },
  {
    kunci: /susah tidur|insomnia|stres|stress|cemas|gelisah|overthinking/i,
    judul: 'Sulit Tidur / Stres',
    saran: ['Tidur & bangun di jam yang sama setiap hari', 'Hindari kopi dan HP 1 jam sebelum tidur',
      'Coba tarik napas dalam atau jalan santai di pagi hari', 'Ceritakan ke orang yang dipercaya'],
    bahaya: 'berlangsung > 2 minggu dan mengganggu aktivitas — konsultasikan ke psikolog/puskesmas',
  },
];

function balasCadangan(teks) {
  const cocok = BASIS.find((b) => b.kunci.test(teks));
  if (!cocok) {
    return 'Terima kasih sudah bercerita. 🙏 Agar saya bisa bantu lebih tepat, boleh jelaskan:\n\n' +
      '• Keluhan utama apa?\n• Sejak kapan?\n• Ada gejala lain (demam, mual, nyeri)?\n• Usia Anda berapa?\n\n' +
      'Contoh: _"Demam sejak 2 hari, badan pegal, usia 20 tahun"_';
  }
  return `💡 *Saran awal untuk ${cocok.judul}:*\n\n${cocok.saran.map((s) => '• ' + s).join('\n')}\n\n` +
    `⚠️ *Segera ke dokter bila:* ${cocok.bahaya}.\n\n` +
    'Mau saya carikan klinik/puskesmas/apotek terdekat? Ketik *3*.\n\n' +
    '_Informasi ini bersifat umum, bukan pengganti pemeriksaan dokter._';
}

module.exports = { balasCadangan, BASIS };
