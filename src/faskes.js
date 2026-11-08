const cfg = require('./config');

const UA = 'SehatkuBot/1.0 (tugas kuliah; whatsapp-web.js)';
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const LABEL = { puskesmas: 'Puskesmas', klinik: 'Klinik', apotek: 'Apotek', rs: 'Rumah Sakit' };
const IKON = { puskesmas: '🏛️', klinik: '🩺', apotek: '💊', rs: '🏥' };

const KATA_KUNCI = {
  apotek: ['apotek', 'pharmacy'],
  puskesmas: ['puskesmas'],
  klinik: ['klinik', 'clinic'],
  rs: ['rumah sakit', 'hospital'],
  semua: ['puskesmas', 'klinik', 'apotek', 'rumah sakit'],
};

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const cache = new Map(); 

function jarakMeter(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function formatJarak(m) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

function klasifikasi(tags) {
  const nama = (tags.name || '').toLowerCase();
  const amenity = tags.amenity || '';
  const hc = tags.healthcare || '';
  if (/puskesmas|pusat kesehatan masyarakat/.test(nama)) return 'puskesmas';
  if (amenity === 'pharmacy' || hc === 'pharmacy' || /apotek|apotik|kimia farma|k-24|k24|guardian|century/.test(nama)) return 'apotek';
  if (amenity === 'hospital' || hc === 'hospital' || /rumah sakit|^rs\b|^rsu|^rsud|^rsia/.test(nama)) return 'rs';
  if (['clinic', 'doctors'].includes(amenity) || ['clinic', 'doctor', 'centre'].includes(hc) || /klinik|clinic|dokter|praktek|praktik/.test(nama)) return 'klinik';
  return null;
}

function formatAlamat(a = {}) {
  const jalan = [a.road, a.house_number].filter(Boolean).join(' ');
  const kel = a.village || a.suburb || a.neighbourhood || a.hamlet;
  const kec = a.city_district || a.district;
  const kota = a.city || a.town || a.county || a.regency;
  return [jalan, kel, kec, kota].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(', ');
}

function cocokJenis(kat, jenis) {
  return kat && (jenis === 'semua' || kat === jenis);
}

async function cariGoogle(lat, lon, jenis, radius) {
  if (!cfg.GOOGLE_MAPS_API_KEY) return [];
  const hasil = [];
  for (const kata of KATA_KUNCI[jenis].filter((k) => !/^(pharmacy|clinic|hospital)$/.test(k))) {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': cfg.GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.currentOpeningHours.openNow,places.nationalPhoneNumber,places.googleMapsUri',
      },
      body: JSON.stringify({
        textQuery: kata,
        languageCode: 'id',
        maxResultCount: 10,
        rankPreference: 'DISTANCE',
        locationBias: { circle: { center: { latitude: lat, longitude: lon }, radius: Math.min(radius, 50000) } },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Google Places ${res.status}`);
    const data = await res.json();
    for (const p of data.places || []) {
      const nama = p.displayName?.text;
      const kat = klasifikasi({ name: nama }) || (kata === 'apotek' ? 'apotek' : kata === 'rumah sakit' ? 'rs' : kata === 'puskesmas' ? 'puskesmas' : 'klinik');
      if (!nama || !cocokJenis(kat, jenis)) continue;
      hasil.push({
        nama, kategori: kat, lat: p.location.latitude, lon: p.location.longitude,
        alamat: p.formattedAddress || '', telepon: p.nationalPhoneNumber || '',
        buka: p.currentOpeningHours?.openNow, rating: p.rating, ulasan: p.userRatingCount,
        maps: p.googleMapsUri,
      });
    }
  }
  return hasil;
}

async function nominatim(params) {
  const url = 'https://nominatim.openstreetmap.org/search?' + new URLSearchParams({ format: 'jsonv2', countrycodes: 'id', ...params });
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'id' }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  return res.json();
}

async function cariNominatim(lat, lon, jenis, radius) {
  const d = radius / 111000; // meter → derajat (perkiraan)
  const viewbox = [lon - d, lat + d, lon + d, lat - d].join(',');
  const hasil = [];
  const kataList = KATA_KUNCI[jenis];
  for (let i = 0; i < kataList.length; i++) {
    if (i > 0) await tidur(1100); 
    const data = await nominatim({ q: kataList[i], viewbox, bounded: '1', limit: '40', addressdetails: '1', extratags: '1' });
    for (const r of data) {
      const tags = { name: r.name, ...(r.extratags || {}) };
      if (r.category === 'amenity') tags.amenity = r.type;
      if (r.category === 'healthcare') tags.healthcare = r.type;
      if (!r.name) continue;
      const kat = klasifikasi(tags);
      if (!cocokJenis(kat, jenis)) continue;
      hasil.push({
        nama: r.name, kategori: kat, lat: parseFloat(r.lat), lon: parseFloat(r.lon),
        alamat: formatAlamat(r.address),
        telepon: tags.phone || tags['contact:phone'] || '',
        jam: tags.opening_hours || '',
      });
    }
  }
  return hasil;
}

async function cariOverpass(lat, lon, jenis, radius) {
  const sel = {
    apotek: ['["amenity"="pharmacy"]'],
    rs: ['["amenity"="hospital"]'],
    klinik: ['["amenity"="clinic"]', '["amenity"="doctors"]'],
    puskesmas: ['["amenity"="clinic"]'],
    semua: ['["amenity"~"^(clinic|hospital|pharmacy|doctors)$"]'],
  }[jenis];
  const q = `[out:json][timeout:8];(${sel.map((t) => `nw${t}(around:${radius},${lat},${lon});`).join('')});out center tags 100;`;
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: 'data=' + encodeURIComponent(q),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const { elements = [] } = await res.json();
      return elements.filter((el) => el.tags?.name).map((el) => {
        const t = el.tags;
        return {
          nama: t.name, kategori: klasifikasi(t), lat: el.lat ?? el.center?.lat, lon: el.lon ?? el.center?.lon,
          alamat: [t['addr:street'], t['addr:housenumber'], t['addr:city']].filter(Boolean).join(' '),
          telepon: t.phone || t['contact:phone'] || '', jam: t.opening_hours || '',
        };
      }).filter((f) => f.lat != null && cocokJenis(f.kategori, jenis));
    } catch { /* coba server berikutnya */ }
  }
  return [];
}

function gabung(lat, lon, daftar, radius) {
  const unik = new Map();
  for (const f of daftar) {
    f.jarak = jarakMeter(lat, lon, f.lat, f.lon);
    if (f.jarak > radius * 1.5) continue;
    const kunci = f.nama.toLowerCase().replace(/[^a-z0-9]/g, '');
    const lama = unik.get(kunci);
    if (!lama) unik.set(kunci, f);
    else unik.set(kunci, { ...f, ...lama, alamat: lama.alamat || f.alamat, telepon: lama.telepon || f.telepon, jam: lama.jam || f.jam });
  }
  return [...unik.values()].sort((a, b) => a.jarak - b.jarak);
}

async function cobaSumber(nama, fn) {
  try {
    const h = await fn();
    console.log(`[Faskes] ${nama}: ${h.length} hasil`);
    return h;
  } catch (e) {
    console.warn(`[Faskes] ${nama} gagal: ${e.message}`);
    return [];
  }
}

async function cariFaskes(lat, lon, jenis = 'semua') {
  const kunciCache = `${lat.toFixed(3)},${lon.toFixed(3)},${jenis}`;
  const c = cache.get(kunciCache);
  if (c && Date.now() - c.waktu < 30 * 60000) return c.data;

  let radius = cfg.RADIUS_METER;
  let semua = [];
  for (let putaran = 0; putaran < 2; putaran++) {
    semua.push(...await cobaSumber('Google', () => cariGoogle(lat, lon, jenis, radius)));
    if (gabung(lat, lon, semua, radius).length < cfg.MAX_HASIL) {
      semua.push(...await cobaSumber('Nominatim', () => cariNominatim(lat, lon, jenis, radius)));
    }
    if (gabung(lat, lon, semua, radius).length < 3) {
      semua.push(...await cobaSumber('Overpass', () => cariOverpass(lat, lon, jenis, radius)));
    }
    if (gabung(lat, lon, semua, radius).length >= 3) break;
    radius *= 3; 
  }
  const data = { hasil: gabung(lat, lon, semua, radius).slice(0, cfg.MAX_HASIL), radius };
  if (data.hasil.length) cache.set(kunciCache, { waktu: Date.now(), data });
  return data;
}

async function geocode(teks) {
  const data = await nominatim({ q: teks, limit: '1' });
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), nama: data[0].display_name };
}

function namaLengkap(f) {
  const kata = { apotek: /apotek|apotik|pharmacy|farma|k-?24/i, puskesmas: /puskesmas/i, klinik: /klinik|clinic|dokter|praktik|praktek|dr\./i, rs: /rumah sakit|hospital|^rs/i }[f.kategori];
  return kata.test(f.nama) ? f.nama : `${LABEL[f.kategori]} ${f.nama}`;
}

function formatHasil({ hasil, radius }, jenis, namaLokasi, lat, lon, dariGps = false) {
  const target = jenis === 'semua' ? 'faskes' : LABEL[jenis].toLowerCase();
  const kata = jenis === 'semua' ? 'klinik puskesmas apotek' : LABEL[jenis].toLowerCase();
  if (!hasil.length) {
    return `Saya belum menemukan data ${target} dalam radius ${formatJarak(radius)} dari lokasi Anda. 🙏\n\n` +
      `Silakan cek langsung di Google Maps:\n🗺️ https://www.google.com/maps/search/${encodeURIComponent(kata)}/@${lat},${lon},15z\n\n` +
      'Atau coba jenis faskes lain: ketik *apotek*, *puskesmas*, *klinik*, atau *rs*.';
  }
  const dari = namaLokasi ? ` dari _${namaLokasi.split(',').slice(0, 2).join(',').trim()}_` : ' dari lokasi Anda';
  let teks = `📍 *${hasil.length} ${target} terdekat*${dari}:\n`;
  hasil.forEach((f, i) => {
    teks += `\n*${i + 1}. ${namaLengkap(f)}*\n`;
    teks += `${IKON[f.kategori]} ${LABEL[f.kategori]}${dariGps ? ` • ${formatJarak(f.jarak)}` : ''}\n`;
    if (f.alamat) teks += `🏠 ${f.alamat}\n`;
    if (f.rating) teks += `⭐ ${f.rating} (${f.ulasan || 0} ulasan)\n`;
    if (f.buka === true) teks += '🟢 Sedang buka\n';
    else if (f.buka === false) teks += '🔴 Sedang tutup\n';
    else if (f.jam) teks += `🕒 ${f.jam}\n`;
    if (f.telepon) teks += `📞 ${f.telepon}\n`;
    teks += `🗺️ https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lon}\n`;
  });
  if (!dariGps) teks += '\n💡 _Agar hasil benar-benar dari posisi Anda (dan jaraknya terlihat), kirim lokasi lewat 📎 → Lokasi._\n';
  if (dariGps) teks += '\n_Jarak adalah perkiraan garis lurus, bukan jarak atau waktu perjalanan._\n';
  teks += '\n_Jam buka bisa berubah, sebaiknya telepon dulu sebelum datang._';
  return teks;
}

module.exports = { cariFaskes, geocode, formatHasil, jarakMeter, klasifikasi, LABEL };
