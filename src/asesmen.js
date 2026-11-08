// Asesmen percakapan, bukan alat diagnosis atau triase klinis tervalidasi.
const PERTANYAAN = {
  usia: 'Berapa usia orang yang mengalami keluhan ini? Tulis misalnya *usia 25 tahun*.',
  durasi: 'Keluhan ini mulai sejak kapan?',
  alergi: 'Apakah ada sesak, sulit menelan, bengkak bibir/lidah, atau terasa akan pingsan? Jika ada, segera ke IGD dan jangan menunggu chat.',
  suhu: 'Berapa suhu terakhir yang diukur? Jika belum mengukur atau tidak punya termometer, tulis *belum diukur*.',
  nyeri: 'Seberapa berat sakit kepalanya, dari 0 sampai 10? Tulis misalnya *nyeri 3/10*.',
  gejala: 'Ada gejala lain atau keluhan yang semakin berat? Ceritakan, atau tulis *tidak ada gejala lain*.',
  risiko: 'Ada riwayat penyakit atau alergi obat? Sebutkan juga bila sedang hamil/menyusui. Jika tidak ada, tulis *tidak ada*.',
  obat: 'Obat atau penanganan apa yang sudah dicoba, dan bagaimana hasilnya? Jika belum, tulis *belum minum obat*.',
};

function keluhanAktif(teks) {
  return teks.replace(/\b(?:tidak|tak|nggak|ngga|gak|ga|tanpa|belum)\s+(?:ada\s+|mengalami\s+)?(?:demam|meriang|batuk|pilek|mual|pegal|gatal|bentol|ruam|alergi obat|sakit kepala|sulit menelan|sesak(?: napas| nafas)?)\b/gi, '');
}

function catat(s, teks) {
  s.asesmen ||= {};
  const a = s.asesmen;
  const t = teks.trim();
  if (s.lanjutan === 'usia' && /^\d{1,3}$/.test(t)) s.profil.usia = t + ' tahun';
  const suhu = t.match(/(?:suhu(?:nya)?\s*|demam\s*)(\d{2}(?:[.,]\d)?)(?:\s*°?\s*c)?\b/i) ||
    (s.lanjutan === 'suhu' && t.match(/^(\d{2}(?:[.,]\d)?)(?:\s*(?:derajat|°?c))?$/i));
  if (suhu && Number(suhu[1].replace(',', '.')) >= 30 && Number(suhu[1].replace(',', '.')) <= 45) a.suhu = suhu[1] + ' °C (keterangan pengguna)';
  if (/belum (?:di)?ukur|tidak (?:punya|ada) termometer|tidak tahu suhu/i.test(t)) a.suhu = 'belum diukur';
  if (s.lanjutan === 'nyeri' && /^\d{1,2}(?:\s*\/\s*10)?$/.test(t) && Number(t.split('/')[0]) <= 10) s.profil.nyeri = t.split('/')[0] + '/10';
  // Jawaban singkat ditafsirkan hanya terhadap satu pertanyaan yang menunggu.
  const dataLain = /\b(usia|umur|suhu|nyeri|sejak)\b|^\d/.test(t) ||
    (s.lanjutan === 'risiko' && /demam|mual|batuk|pilek|pegal|sakit kepala|minum obat/i.test(t));
  if (['alergi', 'gejala', 'risiko', 'obat'].includes(s.lanjutan) && t.length <= 500 && !t.includes('?') && !dataLain) a[s.lanjutan] = t;
  if (/(?:sudah|belum|tidak|sedang)\s+(?:pernah\s+)?(?:minum|konsumsi|mengonsumsi|pakai)\s+obat|(?:sudah|sedang)\s+minum\s+\w+/i.test(t)) a.obat = t;
  if (/riwayat penyakit|alergi obat|(?:tidak|nggak|gak) (?:ada|punya) (?:penyakit|alergi)|(?:punya|memiliki) (?:asma|diabetes|hipertensi|penyakit)|(?:sedang|tidak) hamil|sedang menyusui/i.test(t)) a.risiko = t;
  // Gejala penyerta yang sudah diberikan tidak ditanyakan lagi.
  const jumlah = [/demam|meriang/i, /batuk/i, /pilek/i, /sakit kepala|pusing/i, /mual/i, /pegal/i, /tenggorokan/i, /diare/i, /bentol|gatal|ruam/i].filter(re => re.test(keluhanAktif(t))).length;
  if (jumlah >= 2 || /tidak ada gejala lain/i.test(t)) a.gejala = t;
}

function berikutnya(s) {
  const a = s.asesmen || {};
  const konteks = keluhanAktif(s.keluhan.join('. '));
  let key = null;
  if (/gatal|bentol|biduran|ruam/i.test(konteks) && !a.alergi) key = 'alergi';
  else if (!s.profil.usia) key = 'usia';
  else if (!s.profil.durasi) key = 'durasi';
  else if (/demam|meriang|panas badan/i.test(konteks) && !a.suhu) key = 'suhu';
  else if (/sakit kepala|migrain|kepala sakit/i.test(konteks) && !s.profil.nyeri) key = 'nyeri';
  else if (!a.gejala) key = 'gejala';
  else if (!a.risiko) key = 'risiko';
  else if (!a.obat) key = 'obat';
  s.lanjutan = key;
  return key ? PERTANYAAN[key] : null;
}

function konteks(s) {
  return { profil: s.profil, jawabanLanjutan: s.asesmen || {} };
}

module.exports = { catat, berikutnya, konteks, keluhanAktif };
