const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buatPenerima } = require('../src/whatsapp');
const log = { log() {}, error() {} };
const flush = () => new Promise(resolve => setImmediate(resolve));
function pesan(id, from = 'pengguna@lid', teks = 'menu') {
  return { id: { _serialized: id }, from, type: 'chat', body: teks, getChat: async () => ({ sendStateTyping: async () => {}, clearState: async () => {} }) };
}

test('event WhatsApp ganda diproses dan dikirim satu kali', async () => {
  const kiriman = []; let proses = 0;
  const terima = buatPenerima({ client: { sendMessage: async (...args) => kiriman.push(args) }, handle: async () => { proses++; return ['balasan']; }, log });
  const hasil = await Promise.all([terima(pesan('duplikat')), terima(pesan('duplikat'))]);
  assert.equal(proses, 1); assert.equal(kiriman.length, 1);
  assert.equal(hasil[1].status, 'duplicate');
});

test('antrean mencakup pengiriman: pesan berikutnya menunggu balasan pertama', async () => {
  const kejadian = []; let lepas;
  const gate = new Promise(resolve => { lepas = resolve; });
  const terima = buatPenerima({ client: { sendMessage: async (from, teks) => { kejadian.push('kirim ' + teks); if (teks === 'satu') await gate; } }, handle: async (id, input) => { kejadian.push('proses ' + input.teks); return [input.teks]; }, log });
  const satu = terima(pesan('a', 'orang@lid', 'satu'));
  const dua = terima(pesan('b', 'orang@lid', 'dua'));
  await flush(); assert.deepEqual(kejadian, ['proses satu', 'kirim satu']);
  lepas(); await Promise.all([satu, dua]);
  assert.deepEqual(kejadian, ['proses satu', 'kirim satu', 'proses dua', 'kirim dua']);
});

test('pengguna lain tetap dilayani ketika satu respons lambat', async () => {
  let lepas; const kiriman = [];
  const gate = new Promise(resolve => { lepas = resolve; });
  const terima = buatPenerima({ client: { sendMessage: async (from, teks) => kiriman.push(teks) }, handle: async (id) => { if (id === 'lambat@lid') await gate; return [id]; }, log });
  const lambat = terima(pesan('slow', 'lambat@lid'));
  await terima(pesan('fast', 'cepat@lid'));
  assert.deepEqual(kiriman, ['cepat@lid']); lepas(); await lambat;
});

test('kegagalan kirim ambigu tidak menyebabkan retry ganda; antrean pulih', async () => {
  let kirim = 0, reply = 0, bersih = 0;
  const terima = buatPenerima({ client: { sendMessage: async () => { kirim++; if (kirim === 1) throw new Error('disconnected / timeout'); } }, handle: async () => ['balasan'], log });
  const msg = pesan('gagal'); msg.reply = async () => { reply++; };
  msg.getChat = async () => ({ sendStateTyping: async () => {}, clearState: async () => { bersih++; } });
  assert.equal((await terima(msg)).status, 'failed');
  assert.equal(reply, 0); assert.equal(kirim, 1); assert.equal(bersih, 1);
  assert.equal((await terima(msg)).status, 'duplicate');
  assert.equal((await terima(pesan('lanjut'))).status, 'sent'); assert.equal(kirim, 2);
});

test('ID lid yang gagal indikator mengetik tetap mendapat balasan', async () => {
  let terkirim = 0;
  const terima = buatPenerima({ client: { sendMessage: async () => { terkirim++; } }, handle: async () => ['menu'], log });
  const msg = pesan('lid'); msg.getChat = async () => { throw new Error('getChat unsupported'); };
  assert.equal((await terima(msg)).status, 'sent'); assert.equal(terkirim, 1);
});

test('input lokasi, media, grup, dan status mengikuti jalurnya', async () => {
  const inputs = [], kiriman = [];
  const terima = buatPenerima({ client: { sendMessage: async (from, teks) => kiriman.push(teks) }, handle: async (id, input) => { inputs.push(input); return ['hasil lokasi']; }, log });
  const lokasi = pesan('lokasi'); lokasi.type = 'location'; lokasi.location = { latitude: '-6.4', longitude: '106.8', name: 'lokasi tes' };
  await terima(lokasi);
  assert.deepEqual(inputs[0], { lokasi: { lat: -6.4, lon: 106.8, nama: 'lokasi tes' } });
  const media = pesan('foto'); media.type = 'image'; await terima(media);
  assert.match(kiriman[1], /teks dan lokasi/);
  assert.equal((await terima(pesan('grup', 'grup@g.us'))).status, 'ignored');
  assert.equal((await terima(pesan('status', 'status@broadcast'))).status, 'ignored');
  assert.equal((await terima({ ...pesan('diri'), fromMe: true })).status, 'ignored');
  assert.equal(inputs.length, 1);
});

test('kegagalan pemrosesan memberi satu pesan gangguan dan membersihkan typing', async () => {
  let kirim = 0, bersih = 0;
  const terima = buatPenerima({ client: { sendMessage: async () => { kirim++; } }, handle: async () => { throw new Error('handler error'); }, log });
  const msg = pesan('handler-gagal');
  msg.getChat = async () => ({ sendStateTyping: async () => {}, clearState: async () => { bersih++; } });
  assert.equal((await terima(msg)).status, 'failed'); assert.equal(kirim, 1); assert.equal(bersih, 1);
});
