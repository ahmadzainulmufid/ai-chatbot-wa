const { test } = require('node:test');
const assert = require('node:assert/strict');
const cfg = require('../src/config');
cfg.GEMINI_API_KEY = '';
cfg.ANTHROPIC_API_KEY = '';
const { handle } = require('../src/handler');
const store = require('../src/session');
const faskes = require('../src/faskes');

test('konsultasi mengingat keluhan, menu mempertahankan, reset menghapus', async () => {
  const id = 'uji-konsultasi';
  await handle(id, { teks: '1' });
  const jawaban = await handle(id, { teks: 'Sudah 3 hari sakit kepala sebelah, kadang mual, usia 25' });
  assert.match(jawaban.join(''), /Sakit Kepala/);
  await handle(id, { teks: 'menu' });
  assert.match((await handle(id, { teks: 'ringkasan' })).join(''), /25 tahun/);
  await handle(id, { teks: 'hapus data' });
  assert.equal(store.ambil(id).keluhan.length, 0);
  assert.equal(store.ambil(id).history.length, 0);
});

test('skrining alergi, negasi, dan prioritas darurat', async () => {
  const id = 'uji-alergi';
  assert.match((await handle(id, { teks: 'gatal dan bentol setelah makan udang sejak 1 jam, usia 25' })).join(''), /sulit menelan/);
  assert.doesNotMatch((await handle(id, { teks: 'tidak sesak dan tidak ada bengkak bibir' })).join(''), /KONDISI DARURAT/);
  assert.match((await handle(id, { teks: 'tidak sesak, tapi lidah bengkak' })).join(''), /KONDISI DARURAT/);
  assert.match((await handle(id, { teks: '3' })).join(''), /rumah sakit/);
});

test('durasi sehari-hari tidak ditanyakan ulang dan usia bayi bukan durasi', async () => {
  for (const durasi of ['sejak kemarin', 'dari tadi pagi', 'mulai semalam', 'hari ini', 'barusan']) {
    const id = `uji-durasi-${durasi}`;
    const reply = (await handle(id, { teks: `saya demam ${durasi}, badan pegal, usia 21 tahun` })).join('');
    assert.match(reply, /Saran awal untuk Demam/);
    assert.doesNotMatch(reply, /Keluhan ini mulai sejak kapan/);
    assert.equal(store.ambil(id).profil.durasi, durasi);
  }
  const reply = (await handle('uji-usia-bayi', { teks: 'demam usia 6 bulan' })).join('');
  assert.match(reply, /mulai sejak kapan/);
  assert.equal(store.ambil('uji-usia-bayi').profil.durasi, undefined);
});

test('obat tidak dianggap pencarian apotek dan keluhan setelah oke diproses', async () => {
  assert.match((await handle('uji-obat', { teks: 'obat sakit kepala, usia 25, sejak 2 hari' })).join(''), /Sakit Kepala/);
  await handle('uji-obat', { teks: 'oke tapi sekarang mual' });
  assert.match(store.ambil('uji-obat').keluhan.at(-1), /mual/);
});

test('pencarian tanpa AI menggunakan alamat dan lokasi sebelumnya', async () => {
  const lamaGeo = faskes.geocode, lamaCari = faskes.cariFaskes;
  const panggilan = [];
  faskes.geocode = async alamat => { assert.equal(alamat, 'Cilodong Depok'); return { lat: -6.4, lon: 106.8, nama: alamat }; };
  faskes.cariFaskes = async (lat, lon, jenis) => { panggilan.push(jenis); return { hasil: [], radius: 3000 }; };
  try {
    await handle('uji-faskes', { teks: 'cari klinik di Cilodong Depok' });
    await handle('uji-faskes', { teks: 'apotek' });
    assert.deepEqual(panggilan, ['klinik', 'apotek']);
    assert.match((await handle('uji-faskes', { lokasi: { lat: NaN, lon: 500 } })).join(''), /tidak valid/);
  } finally { faskes.geocode = lamaGeo; faskes.cariFaskes = lamaCari; }
});

test('pesan serentak satu pengirim diproses berurutan', async () => {
  await Promise.all([handle('uji-urutan', { teks: 'sakit kepala sejak 2 hari' }), handle('uji-urutan', { teks: '25' })]);
  assert.equal(store.ambil('uji-urutan').profil.usia, '25 tahun');
});

test('Gemini 404 mencoba model pengganti sekali dengan key di header', async () => {
  const fetchLama = global.fetch;
  cfg.GEMINI_API_KEY = 'dummy-test-key';
  cfg.GEMINI_MODEL = 'gemini-2.5-flash';
  cfg.AI_PROVIDER = 'gemini';
  delete require.cache[require.resolve('../src/ai')];
  const { tanyaAI } = require('../src/ai');
  const urls = [];
  global.fetch = async (url, opts) => {
    urls.push(url);
    assert.equal(opts.headers['x-goog-api-key'], 'dummy-test-key');
    if (urls.length === 1) return { ok: false, status: 404, text: async () => 'model unavailable' };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ intent: 'konsultasi', reply: 'Balasan Rara' }) }] } }] }) };
  };
  try {
    assert.equal((await tanyaAI([], 'halo', null)).reply, 'Balasan Rara');
    assert.equal(urls.length, 2);
    assert.match(urls[1], /gemini-3.1-flash-lite/);
    assert.ok(urls.every(url => !url.includes('dummy-test-key')));
  } finally { global.fetch = fetchLama; cfg.GEMINI_API_KEY = ''; }
});

test('timeout kembali ke cadangan dengan keluhan dan durasi tetap diingat', async () => {
  const fetchLama = global.fetch;
  cfg.GEMINI_API_KEY = 'dummy-test-key';
  global.fetch = async () => { const e = new Error('timed out'); e.name = 'TimeoutError'; throw e; };
  try {
    const reply = (await handle('uji-timeout', { teks: 'saya demam sejak kemarin, badan pegal, usia 21 tahun' })).join('');
    assert.match(reply, /panduan umum/);
    assert.match(reply, /Saran awal untuk Demam/);
    assert.doesNotMatch(reply, /Keluhan ini mulai sejak kapan/);
    assert.equal(store.ambil('uji-timeout').profil.durasi, 'sejak kemarin');
  } finally { global.fetch = fetchLama; cfg.GEMINI_API_KEY = ''; }
});

test('Gemini modern memakai thinking low dan tidak mengulang error kuota', async () => {
  const fetchLama = global.fetch;
  cfg.GEMINI_API_KEY = 'dummy-test-key';
  cfg.GEMINI_MODEL = 'gemini-3.8-flash';
  delete require.cache[require.resolve('../src/ai')];
  const { tanyaAI } = require('../src/ai');
  let jumlah = 0;
  global.fetch = async (url, opts) => {
    jumlah++;
    const body = JSON.parse(opts.body);
    assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, 'low');
    assert.ok(opts.signal);
    return { ok: false, status: 429 };
  };
  try {
    assert.equal(await tanyaAI([], 'halo', null), null);
    assert.equal(jumlah, 1);
  } finally { global.fetch = fetchLama; cfg.GEMINI_API_KEY = ''; }
});

test('503 beralih sekali ke model cadangan dengan konteks yang sama', async () => {
  const fetchLama = global.fetch;
  cfg.GEMINI_API_KEY = 'dummy-test-key';
  cfg.GEMINI_MODEL = 'gemini-3.5-flash-lite';
  const bodies = [], urls = [];
  global.fetch = async (url, opts) => {
    urls.push(url); bodies.push(JSON.parse(opts.body));
    if (urls.length === 1) return { ok: false, status: 503 };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"intent":"konsultasi","reply":"Jawaban cadangan AI"}' }] } }] }) };
  };
  try {
    const { tanyaAI } = require('../src/ai');
    const hasil = await tanyaAI([{ role: 'user', content: 'keluhan sebelumnya' }], 'pesan lanjutan', 'konsultasi');
    assert.equal(hasil.reply, 'Jawaban cadangan AI');
    assert.equal(urls.length, 2);
    assert.match(urls[0], /gemini-3.5-flash-lite/);
    assert.match(urls[1], /gemini-3.1-flash-lite/);
    assert.deepEqual(bodies[0].contents, bodies[1].contents);
  } finally { global.fetch = fetchLama; cfg.GEMINI_API_KEY = ''; }
});

test('deadline menghentikan tunggu fetch dan body yang tidak selesai', async () => {
  const fetchLama = global.fetch, batasLama = cfg.GEMINI_ATTEMPT_TIMEOUT_MS;
  cfg.GEMINI_API_KEY = 'dummy-test-key';
  cfg.GEMINI_ATTEMPT_TIMEOUT_MS = 15;
  const signals = [];
  global.fetch = async (url, opts) => {
    signals.push(opts.signal);
    if (signals.length === 1) return new Promise(() => {});
    return { ok: true, json: () => new Promise(() => {}) };
  };
  try {
    const { tanyaAI } = require('../src/ai');
    assert.equal(await tanyaAI([], 'pesan tes', 'konsultasi'), null);
    assert.equal(signals.length, 2);
    assert.ok(signals.every(signal => signal.aborted));
  } finally { global.fetch = fetchLama; cfg.GEMINI_API_KEY = ''; cfg.GEMINI_ATTEMPT_TIMEOUT_MS = batasLama; }
});

test('ucapan penutup mendapat menu tanpa API atau pemberitahuan tambahan', async () => {
  const fetchLama = global.fetch;
  cfg.GEMINI_API_KEY = 'dummy-test-key';
  let panggilanAI = 0;
  global.fetch = async () => { panggilanAI++; throw new Error('Tidak boleh memanggil AI untuk penutup'); };
  try {
    for (const teks of ['tidak ada rara, terimakasih', 'Terima kasih Rara 🙏', 'makasih banyak ya rara', 'Tidak ada lagi, Rara. Terima kasih!', 'cukup dulu']) {
      const id = `uji-penutup-${teks}`;
      const s = store.ambil(id);
      s.mode = 'konsultasi'; s.pertanyaan = 'durasi';
      s.keluhan.push('demam sejak kemarin');
      const sementara = [];
      const reply = await handle(id, { teks }, async t => sementara.push(t));
      assert.equal(reply.length, 1);
      assert.match(reply[0], /Sama-sama/);
      assert.match(reply[0], /Pilih layanan/);
      assert.match(reply[0], /Ringkasan Kesehatan/);
      assert.deepEqual(sementara, []);
      assert.equal(s.mode, null);
      assert.equal(s.pertanyaan, null);
      assert.equal(s.keluhan.length, 1);
    }
    assert.equal(panggilanAI, 0);
  } finally { global.fetch = fetchLama; cfg.GEMINI_API_KEY = ''; }
});

test('terima kasih disertai keluhan atau pertanyaan bukan penutup', () => {
  const { adalahPenutup } = require('../src/pesan');
  for (const teks of ['terima kasih tapi saya masih demam', 'makasih rara, obatnya apa?', 'terimakasih, saya sulit bernapas', 'tidak ada alergi obat', 'oke tapi sekarang mual']) {
    assert.equal(adalahPenutup(teks), false, teks);
  }
});

test('AI lambat tidak mengirim pesan timer sebelum atau setelah balasan', async t => {
  const fetchLama = global.fetch;
  cfg.GEMINI_API_KEY = 'dummy-test-key';
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let selesaikan;
  const sementara = [];
  global.fetch = () => new Promise(resolve => { selesaikan = resolve; });
  const flush = () => new Promise(resolve => setImmediate(resolve));
  try {
    const hasil = handle('uji-tanpa-pesan-terlambat', { teks: 'demam sejak kemarin, usia 21 tahun' }, async teks => sementara.push(teks));
    await flush();
    t.mock.timers.tick(8001);
    await flush();
    assert.deepEqual(sementara, []);
    selesaikan({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"intent":"konsultasi","reply":"Jawaban konsultasi"}' }] } }] }) });
    const balasan = await hasil;
    assert.equal(balasan.length, 1);
    assert.match(balasan[0], /^Jawaban konsultasi/);
    assert.match(balasan[0], /suhu terakhir/);
    t.mock.timers.tick(20000);
    await flush();
    assert.deepEqual(sementara, []);
  } finally { t.mock.timers.reset(); global.fetch = fetchLama; cfg.GEMINI_API_KEY = ''; }
});