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

// US AQI dari PM2.5 (breakpoint US EPA 2024), dipakai bila us_aqi dari API kosong.
function aqiDariPm25(pm) {
  if (!Number.isFinite(pm)) return null;
  const c = Math.floor(pm * 10) / 10;
  const bp = [[0, 9.0, 0, 50], [9.1, 35.4, 51, 100], [35.5, 55.4, 101, 150], [55.5, 125.4, 151, 200],
    [125.5, 225.4, 201, 300], [225.5, 325.4, 301, 500]];
  const b = bp.find(([lo, hi]) => c >= lo && c <= hi) || bp[bp.length - 1];
  return Math.round(((b[3] - b[2]) / (b[1] - b[0])) * (Math.min(c, b[1]) - b[0]) + b[2]);
}

async function ambilJson(url) {
  let errTerakhir;
  for (let i = 0; i < 2; i++) { // coba ulang sekali bila jaringan bermasalah
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      errTerakhir = e;
    }
  }
  throw errTerakhir;
}

async function cekUdara(lat, lon) {
  const kunci = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const c = cache.get(kunci);
  if (c && Date.now() - c.waktu < 30 * 60000) return c.data;
  const url = `${URL_API}?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5,pm10` +
    '&hourly=us_aqi,pm2_5,pm10&past_days=1&forecast_days=1&timezone=Asia%2FJakarta';
  const json = await ambilJson(url);
  const cur = json.current || {};
  let { us_aqi: aqi, pm2_5: pm25, pm10, time: waktu } = cur;

  // Nilai "saat ini" kosong → pakai jam terakhir yang punya data.
  if (!Number.isFinite(aqi) || !Number.isFinite(pm25)) {
    const h = json.hourly || {};
    const sekarang = cur.time || new Date().toISOString().slice(0, 13);
    for (let i = (h.time || []).length - 1; i >= 0; i--) {
      if (h.time[i] > sekarang) continue;
      if (Number.isFinite(h.us_aqi?.[i]) || Number.isFinite(h.pm2_5?.[i])) {
        aqi = Number.isFinite(aqi) ? aqi : h.us_aqi?.[i];
        pm25 = Number.isFinite(pm25) ? pm25 : h.pm2_5?.[i];
        pm10 = Number.isFinite(pm10) ? pm10 : h.pm10?.[i];
        waktu = h.time[i]; // tampilkan jam data yang benar-benar dipakai
        break;
      }
    }
  }
  if (!Number.isFinite(aqi)) aqi = aqiDariPm25(pm25);
  if (!Number.isFinite(aqi)) throw new Error('Data AQI/PM2.5 kosong untuk lokasi ini');

  const data = { aqi: Math.round(aqi), pm25, pm10, waktu: waktu || null };
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
    'Ketik *1* untuk konsultasi kesehatan atau *menu* untuk layanan lain.';
}

module.exports = { cekUdara, formatUdara, kategori, aqiDariPm25 };