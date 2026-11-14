// Info kualitas udara memakai Open-Meteo Air Quality API (gratis untuk non-komersial, tanpa API key).
// Data berasal dari model CAMS (perkiraan, resolusi ±11–45 km), bukan stasiun pengukur resmi.
// Indeks yang dipakai: US AQI (standar US EPA) + konsentrasi PM2.5 dan PM10.

const URL_API = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const cache = new Map(); // hasil disimpan 30 menit per lokasi

// Kategori US AQI + anjuran praktis.
const KATEGORI = [
  { maks: 50, label: 'Baik', ikon: '🟢', anjuran: [
    'Udara aman untuk beraktivitas di luar ruangan.',
    'Waktu yang baik untuk olahraga di luar dan membuka jendela agar sirkulasi udara lancar.',
  ] },
  { maks: 100, label: 'Sedang', ikon: '🟡', anjuran: [
    'Umumnya aman untuk beraktivitas di luar.',
    'Orang yang sangat sensitif (asma, penyakit paru/jantung) sebaiknya mengurangi aktivitas berat yang lama di luar.',
  ] },
  { maks: 150, label: 'Tidak sehat bagi kelompok sensitif', ikon: '🟠', anjuran: [
    'Anak-anak, lansia, ibu hamil, dan penderita asma/penyakit paru/jantung sebaiknya mengurangi aktivitas lama di luar.',
    'Gunakan masker yang rapat (mis. KN95/N95) bila harus lama di luar.',
    'Penderita asma: bawa obat pereda sesuai anjuran dokter.',
  ] },
  { maks: 200, label: 'Tidak sehat', ikon: '🔴', anjuran: [
    'Kurangi aktivitas berat di luar ruangan untuk semua orang.',
    'Pakai masker yang rapat (KN95/N95) saat di luar; masker kain kurang efektif menyaring PM2.5.',
    'Tutup jendela saat polusi tinggi dan pindahkan olahraga ke dalam ruangan.',
  ] },
  { maks: 300, label: 'Sangat tidak sehat', ikon: '🟣', anjuran: [
    'Hindari aktivitas di luar ruangan bila memungkinkan.',
    'Tetap di dalam ruangan dengan jendela tertutup; pakai pembersih udara bila ada.',
    'Kelompok sensitif sebaiknya tidak keluar rumah kecuali perlu.',
  ] },
  { maks: Infinity, label: 'Berbahaya', ikon: '🟤', anjuran: [
    'Tetap di dalam ruangan dan hindari semua aktivitas di luar.',
    'Ikuti arahan pemerintah/otoritas setempat.',
  ] },
];

function kategori(aqi) {
  return KATEGORI.find(k => aqi <= k.maks);
}

async function cekUdara(lat, lon) {
  const kunci = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const c = cache.get(kunci);
  if (c && Date.now() - c.waktu < 30 * 60000) return c.data;
  const url = `${URL_API}?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5,pm10&timezone=Asia%2FJakarta`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const json = await res.json();
  const cur = json.current || {};
  if (!Number.isFinite(cur.us_aqi)) throw new Error('Data AQI tidak tersedia');
  const data = { aqi: Math.round(cur.us_aqi), pm25: cur.pm2_5, pm10: cur.pm10, waktu: cur.time || null };
  cache.set(kunci, { waktu: Date.now(), data });
  return data;
}

function formatUdara(d, namaLokasi) {
  const k = kategori(d.aqi);
  const tempat = namaLokasi ? namaLokasi.split(',').slice(0, 2).join(',').trim() : 'lokasi Anda';
  const jam = d.waktu ? ` (pukul ${String(d.waktu).slice(11, 16)} WIB)` : '';
  const angka = (v) => (Number.isFinite(v) ? v.toFixed(1).replace('.', ',') : '-');
  return `🌬️ *Kualitas Udara — ${tempat}*${jam}\n\n` +
    `${k.ikon} *${k.label}* · AQI *${d.aqi}*\n` +
    `• PM2.5: ${angka(d.pm25)} µg/m³\n` +
    `• PM10: ${angka(d.pm10)} µg/m³\n\n` +
    `✅ *Anjuran*\n${k.anjuran.map(a => '• ' + a).join('\n')}\n\n` +
    '🚨 Bila muncul sesak napas berat, nyeri dada, atau bibir kebiruan, segera ke IGD / hubungi *119*.\n\n' +
    '_Perkiraan model CAMS via Open-Meteo (indeks US AQI), bisa berbeda dari stasiun pengukur resmi setempat._\n' +
    'Ketik *3* untuk konsultasi kesehatan pernapasan atau *menu* untuk layanan lain.';
}

module.exports = { cekUdara, formatUdara, kategori };
