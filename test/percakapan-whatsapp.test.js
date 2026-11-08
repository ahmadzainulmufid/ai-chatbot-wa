const { test } = require('node:test');
const assert = require('node:assert/strict');
const cfg = require('../src/config');
cfg.GEMINI_API_KEY = ''; cfg.ANTHROPIC_API_KEY = '';
const { handle } = require('../src/handler');
const { buatPenerima } = require('../src/whatsapp');
const sesi = require('../src/session');
const log = { log() {}, error() {} };

test('percakapan WhatsApp utuh: menu, konsultasi, jawaban singkat, penutup, ringkasan', async () => {
  const terkirim = [];
  const terima = buatPenerima({ client: { sendMessage: async (id, teks) => terkirim.push(teks) }, handle, log });
  const pesan = ['menu', '1', 'saya demam sejak kemarin, badan pegal, usia 21 tahun', '38.2', 'tidak ada', 'belum minum obat', 'tidak ada rara, terimakasih', 'ringkasan'];
  // Event tiba bersamaan, seperti pesan bertubi-tubi dari satu perangkat.
  const hasil = await Promise.all(pesan.map((body, i) => terima({ from: 'percakapan@lid', id: { _serialized: 'utuh-' + i }, type: 'chat', body, getChat: async () => { throw new Error('lid'); } })));
  assert.ok(hasil.every(h => h.status === 'sent'));
  assert.equal(terkirim.length, pesan.length);
  assert.match(terkirim[2], /suhu terakhir/);
  assert.match(terkirim[3], /riwayat penyakit/);
  assert.match(terkirim[4], /penanganan apa yang sudah dicoba/);
  assert.match(terkirim[6], /Sama-sama[\s\S]*Pilih layanan/);
  assert.match(terkirim[7], /38.2 °C/);
  assert.ok(terkirim.every(t => !t.includes('masih menyiapkan')));
  assert.equal(sesi.ambil('percakapan@lid').lanjutan, null);
});

test('gejala yang disangkal tidak menjadi pertanyaan suhu atau saran demam', async () => {
  const reply = (await handle('batuk-tanpa-demam', { teks: 'batuk dan pilek sejak 2 hari, usia 25, tidak demam' })).join('');
  assert.match(reply, /Batuk \/ Pilek/);
  assert.doesNotMatch(reply, /Saran awal untuk Demam|suhu terakhir/);
});

test('jawaban baru di luar pertanyaan tidak dianggap riwayat yang sudah lengkap', async () => {
  const id = 'jawaban-di-luar-topik';
  await handle(id, { teks: 'demam dan pegal sejak kemarin, usia 21, suhu 38.2' });
  assert.equal(sesi.ambil(id).lanjutan, 'risiko');
  const reply = (await handle(id, { teks: 'sekarang mual juga' })).join('');
  assert.equal(sesi.ambil(id).asesmen.risiko, undefined);
  assert.match(reply, /riwayat penyakit/);
});

test('terima kasih dengan keluhan baru tetap melalui asesmen', async () => {
  const id = 'terima-kasih-dengan-keluhan';
  await handle(id, { teks: 'demam dan pegal sejak kemarin, usia 21' });
  const reply = (await handle(id, { teks: 'terima kasih, tapi saya sekarang mual' })).join('');
  assert.doesNotMatch(reply, /Sama-sama/);
  assert.match(sesi.ambil(id).keluhan.at(-1), /sekarang mual/);
});
