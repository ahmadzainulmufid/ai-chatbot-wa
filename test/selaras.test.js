const { test } = require('node:test');
const assert = require('node:assert/strict');
const cfg = require('../src/config');
cfg.GEMINI_API_KEY = ''; cfg.ANTHROPIC_API_KEY = '';
const { handle } = require('../src/handler');
const faskes = require('../src/faskes');
const udara = require('../src/udara');
const P = require('../src/pesan');

function palsuFetch(aqi = 135) {
  const panggilan = [];
  const lama = global.fetch;
  global.fetch = async (url) => {
    panggilan.push(String(url));
    if (String(url).includes('air-quality-api.open-meteo.com')) {
      return { ok: true, json: async () => ({ current: { time: '2026-11-14T19:00', us_aqi: aqi, pm2_5: 48.3, pm10: 61.2 } }) };
    }
    throw new Error('tidak terduga: ' + url);
  };
  return { panggilan, pulihkan: () => { global.fetch = lama; } };
}

test('menu berurutan sesuai polling', () => {
  const urutan = ['Konsultasi Kesehatan', 'Ringkasan Kesehatan', 'Cari Klinik / Apotek', 'Nomor Darurat', 'Udara Saat Ini', 'About Me', 'Tips Hidup Sehat'];
  const pos = urutan.map(t => P.MENU.indexOf(t));
  assert.ok(pos.every(p => p > 0), JSON.stringify(pos));
  assert.deepEqual([...pos].sort((a, b) => a - b), pos);
  assert.match(P.SAPAAN, /Virtual Assistant #SELARAS/);
});

test('1 konsultasi, 2 ringkasan, 4 darurat, 6 about me (file konten), 7 tips', async () => {
  assert.match((await handle('m-kons', { teks: '1' })).join(''), /Konsultasi Kesehatan/);
  assert.match((await handle('m-ring', { teks: '2' })).join(''), /Belum ada konsultasi/);
  assert.match((await handle('m-darurat', { teks: '4' })).join(''), /119/);
  assert.match((await handle('m-about', { teks: '6' })).join(''), /About Me[\s\S]*Rara/);
  assert.match((await handle('m-tips', { teks: '7' })).join(''), /Tips Hidup Sehat/);
});

test('5 → minta lokasi, lalu lokasi WhatsApp dipakai untuk cek kualitas udara (bukan faskes)', async () => {
  const f = palsuFetch(135);
  try {
    assert.match((await handle('udara-gps', { teks: '5' })).join(''), /kirim lokasi/i);
    const hasil = (await handle('udara-gps', { lokasi: { lat: -6.4, lon: 106.82 } })).join('');
    assert.match(hasil, /Kualitas Udara/);
    assert.match(hasil, /AQI \*135\*/);
    assert.match(hasil, /Tidak sehat bagi kelompok sensitif/);
    assert.match(hasil, /PM2\.5: 48,3/);
    assert.ok(f.panggilan[0].includes('latitude=-6.4'));
  } finally { f.pulihkan(); }
});

test('"kualitas udara di Depok" langsung dicek tanpa lewat menu', async () => {
  const f = palsuFetch(42);
  const lamaGeo = faskes.geocode;
  faskes.geocode = async (alamat) => { assert.equal(alamat, 'Depok'); return { lat: -6.39, lon: 106.81, nama: 'Depok, Jawa Barat' }; };
  try {
    const hasil = (await handle('udara-teks', { teks: 'kualitas udara di Depok' })).join('');
    assert.match(hasil, /Kualitas Udara — Depok/);
    assert.match(hasil, /Baik/);
  } finally { f.pulihkan(); faskes.geocode = lamaGeo; }
});

test('keluhan kesehatan saat di menu udara tetap dijawab sebagai konsultasi', async () => {
  await handle('udara-keluhan', { teks: '5' });
  const hasil = (await handle('udara-keluhan', { teks: 'batuk berdahak sejak 3 hari, usia 25' })).join('');
  assert.doesNotMatch(hasil, /Kualitas Udara —/);
  assert.match(hasil, /Batuk/);
});

test('kategori AQI sesuai rentang', () => {
  assert.equal(udara.kategori(30).label, 'Baik');
  assert.equal(udara.kategori(100).label, 'Sedang');
  assert.equal(udara.kategori(180).label, 'Tidak sehat');
  assert.equal(udara.kategori(350).label, 'Berbahaya');
});