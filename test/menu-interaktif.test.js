const { test } = require('node:test');
const assert = require('node:assert/strict');
const cfg = require('../src/config');
cfg.GEMINI_API_KEY = ''; cfg.ANTHROPIC_API_KEY = '';
const P = require('../src/pesan');
const { buatPenerima, rencanaKiriman } = require('../src/whatsapp');
const { handle } = require('../src/handler');
const log = { log() {}, error() {} };

class PollPalsu { constructor(nama, opsi) { this.pollName = nama; this.pollOptions = opsi.map((name, localId) => ({ name, localId })); } }
const MediaPalsu = { fromFilePath: (p) => ({ media: p }) };

function klienPalsu(opsi = {}) {
  const kiriman = []; let n = 0;
  return {
    kiriman,
    getChatById: async () => ({ sendStateTyping: async () => {}, clearState: async () => {} }),
    sendMessage: async (to, isi, o) => {
      if (opsi.tolakPolling && isi instanceof PollPalsu) throw new Error('polling ditolak');
      kiriman.push({ to, isi, o });
      return { id: { _serialized: 'pesan-' + (++n) } };
    },
  };
}
const pesan = (id, body, from = 'pengguna@lid') => ({ id: { _serialized: id }, from, type: 'chat', body, getChat: async () => { throw new Error('lid'); } });

test('mode teks (default) tidak berubah', () => {
  assert.deepEqual(rencanaKiriman(P.MENU, { interaktif: false }), [{ tipe: 'teks', teks: P.MENU }]);
});

test('sapaan pertama: banner bergambar lalu menu polling', async () => {
  const k = klienPalsu();
  const terima = buatPenerima({ client: k, handle, log, interaktif: true, polling: true, Poll: PollPalsu, MessageMedia: MediaPalsu, banner: '/banner.png' });
  await terima(pesan('s1', 'halo', 'baru@lid'));
  assert.equal(k.kiriman.length, 2);
  assert.deepEqual(k.kiriman[0].isi, { media: '/banner.png' });
  assert.match(k.kiriman[0].o.caption, /Rara[\s\S]*Ketuk salah satu/);
  assert.doesNotMatch(k.kiriman[0].o.caption, /\*1\.\*/, 'daftar angka tidak diulang di caption');
  assert.ok(k.kiriman[1].isi instanceof PollPalsu);
  assert.equal(k.kiriman[1].isi.pollOptions.length, 6);
});

test('memilih opsi polling diproses seperti mengetik angka', async () => {
  const k = klienPalsu();
  const terima = buatPenerima({ client: k, handle, log, interaktif: true, polling: true, Poll: PollPalsu, MessageMedia: MediaPalsu, banner: '/b.png' });
  await terima(pesan('m1', 'menu', 'pilih@lid'));
  const poll = k.kiriman.find(x => x.isi instanceof PollPalsu);
  assert.ok(poll);
  const pollId = 'pesan-' + (k.kiriman.indexOf(poll) + 1);
  // Opsi ke-5 (localId 4) = Cari faskes → minta lokasi + polling jenis faskes
  await terima.pilihan({ parentMessage: { id: { _serialized: pollId } }, selectedOptions: [{ localId: 4 }], interractedAtTs: 1 });
  const teks = k.kiriman.filter(x => typeof x.isi === 'string').map(x => x.isi).join('\n');
  assert.match(teks, /kirim lokasi/i);
  const pollFaskes = k.kiriman.filter(x => x.isi instanceof PollPalsu).at(-1);
  assert.match(pollFaskes.isi.pollName, /Jenis fasilitas/);
  assert.equal(pollFaskes.to, 'pilih@lid');
});

test('pilihan dibatalkan atau polling asing diabaikan', async () => {
  const terima = buatPenerima({ client: klienPalsu(), handle, log, interaktif: true, polling: true, Poll: PollPalsu });
  assert.equal((await terima.pilihan({ parentMessage: { id: { _serialized: 'tidak-dikenal' } }, selectedOptions: [{ localId: 0 }] })).status, 'ignored');
  assert.equal((await terima.pilihan({ parentMessage: { id: { _serialized: 'x' } }, selectedOptions: [] })).status, 'ignored');
});

test('polling gagal dikirim → otomatis kembali ke menu angka', async () => {
  const k = klienPalsu({ tolakPolling: true });
  const terima = buatPenerima({ client: k, handle, log, interaktif: true, polling: true, Poll: PollPalsu });
  await terima(pesan('f1', 'menu', 'cadangan@lid'));
  assert.ok(k.kiriman.some(x => typeof x.isi === 'string' && x.isi.includes('*1.*')));
});
