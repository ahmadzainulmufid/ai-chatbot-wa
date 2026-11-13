const test = require('node:test');
const assert = require('node:assert');
const { susun, formatRekomendasi } = require('../src/mutu');

test('saat masih bertanya: tanggapan lalu pertanyaan, tanpa peringatan IGD', () => {
  const hasil = susun('Baik, sudah 4 hari ya.', 'Obat apa yang sudah dicoba?');
  assert.strictEqual(hasil, 'Baik, sudah 4 hari ya.\n\nObat apa yang sudah dicoba?');
  assert.doesNotMatch(hasil, /IGD/);
});

test('saat informasi cukup tanpa bagian terstruktur: peringatan IGD tetap di bawah', () => {
  const hasil = susun('Kemungkinan infeksi saluran napas ringan.\n\n• Perbanyak istirahat', null);
  const posAnjuran = hasil.indexOf('Perbanyak istirahat');
  const posIGD = hasil.indexOf('segera ke IGD');
  assert.ok(posAnjuran >= 0 && posIGD > posAnjuran, 'peringatan IGD harus setelah anjuran');
  assert.match(hasil, /ringkasan/);
});

test('peringatan tidak diulang bila AI sudah menyebut IGD', () => {
  const hasil = susun('Bila sesak, segera ke IGD.', null);
  assert.strictEqual(hasil.match(/IGD/g).length, 1);
});

test('pertanyaan buatan AI dibuang agar pertanyaan dipilih aplikasi', () => {
  const hasil = susun('Baik. Sudah berapa lama?', 'Berapa suhu terakhir?');
  assert.strictEqual(hasil, 'Baik.\n\nBerapa suhu terakhir?');
});

test('jawaban akhir terstruktur: data → penyebab → anjuran → dokter → IGD → penutup', () => {
  const s = { profil: { usia: '22 tahun', durasi: 'sejak 4 hari' }, asesmen: { obat: 'baru minum paracetamol' } };
  const hasil = susun('Terima kasih sudah bercerita. Sudah minum apa?', null, {
    penyebab: 'Kemungkinan infeksi virus saluran napas atas.',
    anjuran: ['Minum air hangat', 'Istirahat cukup'],
    ke_dokter: 'bila tidak membaik dalam 3 hari',
    tanda_bahaya: ['Sesak napas', 'Batuk berdarah'],
  }, s);
  const urutan = ['Data keluhan', '22 tahun', 'Kemungkinan penyebab', 'Yang bisa dilakukan sekarang', 'Periksa ke dokter', 'Segera ke IGD', 'bukan diagnosis'];
  const posisi = urutan.map(k => hasil.indexOf(k));
  assert.ok(posisi.every(p => p >= 0), 'semua bagian ada: ' + JSON.stringify(posisi));
  assert.deepStrictEqual([...posisi].sort((a, b) => a - b), posisi, 'urutan bagian benar');
  assert.doesNotMatch(hasil, /\?/, 'tidak ada pertanyaan tersisa');
  assert.match(hasil, /bila\*\nTidak membaik/, 'awalan "bila" tidak dobel');
});

test('tanda bahaya umum dipakai bila AI tidak memberi daftar spesifik', () => {
  const hasil = formatRekomendasi({ penyebab: 'Kemungkinan kelelahan.', anjuran: ['Istirahat'] });
  assert.match(hasil, /Segera ke IGD[\s\S]*Sesak napas/);
});
