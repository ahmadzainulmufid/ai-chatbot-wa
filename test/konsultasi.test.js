const { test } = require('node:test');
const assert = require('node:assert/strict');
const cfg = require('../src/config');
cfg.GEMINI_API_KEY = ''; cfg.ANTHROPIC_API_KEY = '';
const { handle } = require('../src/handler');
const sesi = require('../src/session');
const mutu = require('../src/mutu');

test('percakapan demam menggali data kosong satu per satu tanpa bertanya ulang', async () => {
  const id = 'demam-terarah';
  let reply = (await handle(id, { teks: 'demam sejak kemarin, badan pegal, usia 21 tahun' })).join('');
  assert.match(reply, /suhu terakhir/);
  assert.doesNotMatch(reply, /Berapa usia|mulai sejak kapan/);
  reply = (await handle(id, { teks: '38,5' })).join('');
  assert.match(reply, /riwayat penyakit atau alergi obat/);
  assert.doesNotMatch(reply, /suhu terakhir/);
  reply = (await handle(id, { teks: 'tidak ada' })).join('');
  assert.match(reply, /penanganan apa yang sudah dicoba/);
  assert.doesNotMatch(reply, /Ada riwayat/);
  reply = (await handle(id, { teks: 'belum minum obat' })).join('');
  assert.equal(sesi.ambil(id).lanjutan, null);
  assert.doesNotMatch(reply, /suhu terakhir|Berapa usia|mulai sejak kapan|Ada riwayat|penanganan apa yang sudah dicoba/);
  const ringkasan = (await handle(id, { teks: 'ringkasan' })).join('');
  assert.match(ringkasan, /38,5 °C/);
  assert.match(ringkasan, /Riwayat\/alergi obat: tidak ada/);
});

test('belum diukur diingat, tidak dipaksa mengarang suhu', async () => {
  const id = 'tanpa-termometer';
  await handle(id, { teks: 'demam dan pegal sejak kemarin, usia 25' });
  const reply = (await handle(id, { teks: 'belum diukur' })).join('');
  assert.equal(sesi.ambil(id).asesmen.suhu, 'belum diukur');
  assert.doesNotMatch(reply, /suhu terakhir/);
});

test('riwayat yang sudah disampaikan tidak ditanya ulang dan reset membersihkan asesmen', async () => {
  const id = 'data-lengkap';
  const reply = (await handle(id, { teks: 'demam dan pegal sejak kemarin, usia 25, suhu 38.2, tidak ada alergi obat atau riwayat penyakit, belum minum obat' })).join('');
  assert.equal(sesi.ambil(id).lanjutan, null);
  assert.doesNotMatch(reply, /suhu terakhir|Ada riwayat|penanganan apa yang sudah dicoba/);
  await handle(id, { teks: 'keluhan baru' });
  assert.deepEqual(sesi.ambil(id).asesmen, {});
  assert.equal(sesi.ambil(id).lanjutan, null);
});

test('jawaban singkat afirmatif pada skrining alergi diarahkan darurat', async () => {
  const id = 'afirmasi-alergi';
  await handle(id, { teks: 'gatal dan bentol setelah udang sejak 1 jam, usia 25' });
  assert.equal(sesi.ambil(id).lanjutan, 'alergi');
  assert.match((await handle(id, { teks: 'iya' })).join(''), /KONDISI DARURAT/);
});

test('negasi pada skrining alergi tidak dianggap afirmasi, sesak tetap diprioritaskan', async () => {
  await handle('alergi-negasi', { teks: 'gatal sejak 1 jam, usia 25' });
  assert.doesNotMatch((await handle('alergi-negasi', { teks: 'iya tidak ada sesak dan tidak sulit menelan' })).join(''), /KONDISI DARURAT/);
  await handle('alergi-sesak', { teks: 'gatal sejak 1 jam, usia 25' });
  assert.match((await handle('alergi-sesak', { teks: 'iya ada sesak' })).join(''), /KONDISI DARURAT/);
});

test('filter menolak diagnosis pasti, dosis, obat resep, pantangan, dan jaminan', () => {
  const s = { profil: { usia: '25 tahun' }, asesmen: {} };
  for (const reply of ['Anda pasti terkena flu.', 'Minum parasetamol 500 mg.', 'Minum amoxicillin untuk pilek.', 'Hindari gorengan dan makanan manis.', 'Istirahat total sampai sembuh.', 'Tidak perlu ke dokter.']) {
    assert.ok(mutu.periksa(reply, s).length > 0, reply);
  }
  assert.deepEqual(mutu.periksa('Istirahat cukup dan minum air. Hubungi dokter jika memburuk. Jangan menggunakan antibiotik tanpa resep dokter.', s), []);
});

test('AI dengan isi berisiko diganti sebelum disimpan dan dikirim', async () => {
  const lama = global.fetch; cfg.GEMINI_API_KEY = 'dummy';
  global.fetch = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ intent: 'konsultasi', reply: 'Anda pasti terkena flu. Minum amoxicillin 500 mg. Hindari gorengan.' }) }] } }] }) });
  try {
    const reply = (await handle('uji-mutu-ai', { teks: 'demam sejak kemarin, badan pegal, usia 21' })).join('');
    assert.doesNotMatch(reply, /amoxicillin|500 mg|pasti terkena|gorengan/);
    assert.match(reply, /suhu terakhir/);
    assert.doesNotMatch(sesi.ambil('uji-mutu-ai').history.at(-1).content, /amoxicillin/);
  } finally { global.fetch = lama; cfg.GEMINI_API_KEY = ''; }
});

test('pertanyaan AI yang mengulang data diganti pertanyaan terarah aplikasi', async () => {
  const lama = global.fetch; cfg.GEMINI_API_KEY = 'dummy';
  global.fetch = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ intent: 'konsultasi', reply: 'Terima kasih sudah bercerita. Berapa usia Anda? Sejak kapan demamnya?' }) }] } }] }) });
  try {
    const reply = (await handle('uji-pertanyaan-ai', { teks: 'demam dan pegal sejak kemarin, usia 21' })).join('');
    assert.doesNotMatch(reply, /Berapa usia|Sejak kapan/);
    assert.match(reply, /suhu terakhir/);
    assert.equal((reply.match(/\?/g) || []).length, 1);
  } finally { global.fetch = lama; cfg.GEMINI_API_KEY = ''; }
});
