// Transport diisolasi agar dapat diuji tanpa login atau mengirim ke WhatsApp asli.
//
// Mode interaktif (opsional):
// - Sapaan pertama dikirim sebagai banner gambar + menu polling yang bisa diketuk.
// - Menu dan pilihan jenis faskes dikirim sebagai polling.
// - Pilihan polling diproses persis seperti pengguna mengetik angka/kata menu.
// Bila polling/gambar gagal dikirim, otomatis kembali ke teks biasa.
const P = require('./pesan');

// Pilihan polling. Nilainya = nomor menu (P.MENU), jadi mengetuk sama dengan mengetik angkanya.
// Tips hidup sehat (7) dan privasi tetap bisa diketik.
const MENU_POLLING = {
  judul: 'Pilih layanan Rara 👇',
  opsi: [
    ['🩺 Konsultasi Kesehatan', '1'],
    ['📋 Ringkasan Kesehatan', '2'],
    ['📍 Cari Klinik / Apotek', '3'],
    ['🚑 Nomor Darurat', '4'],
    ['🌬️ Udara Saat Ini', '5'],
    ['🙋‍♀️ About Me', '6'],
  ],
};

const FASKES_POLLING = {
  judul: 'Jenis fasilitas kesehatan yang dicari:',
  opsi: [
    ['🏥 Semua faskes', 'semua'],
    ['💊 Apotek', 'apotek'],
    ['🏛️ Puskesmas', 'puskesmas'],
    ['🩺 Klinik', 'klinik'],
    ['🚑 Rumah Sakit', 'rs'],
  ],
};

const BARIS_JENIS_FASKES = /\n*Mau jenis tertentu\? Ketik:[^\n]*/;

// Ubah satu balasan teks menjadi daftar kiriman (teks / gambar / polling).
// polling=false (bawaan): sapaan = banner + menu angka dalam SATU pesan; selebihnya teks biasa.
// polling=true            : menu & jenis faskes dikirim sebagai polling yang bisa diketuk.
function rencanaKiriman(teks, { interaktif, adaBanner, polling = false }) {
  if (!interaktif) return [{ tipe: 'teks', teks }];
  if (!polling) {
    if (teks === P.SAPAAN && adaBanner) return [{ tipe: 'gambar', caption: teks, cadangan: teks }];
    return [{ tipe: 'teks', teks }];
  }
  if (teks.includes(P.MENU)) {
    const sebelum = teks.replace(P.MENU, '').replace(/\n{3,}/g, '\n\n').trim();
    const kiriman = [];
    if (teks === P.SAPAAN) {
      const sapaan = sebelum + '\n\nKetuk salah satu pilihan di bawah 👇 atau langsung ceritakan keluhan Anda.\nPerintah: *menu*, *ringkasan*, *keluhan baru*.';
      kiriman.push(adaBanner ? { tipe: 'gambar', caption: sapaan, cadangan: sapaan } : { tipe: 'teks', teks: sapaan });
    } else if (sebelum) {
      kiriman.push({ tipe: 'teks', teks: sebelum });
    }
    kiriman.push({ tipe: 'polling', ...MENU_POLLING, cadangan: P.MENU });
    return kiriman;
  }
  if (BARIS_JENIS_FASKES.test(teks)) {
    return [
      { tipe: 'teks', teks: teks.replace(BARIS_JENIS_FASKES, '').trim() },
      { tipe: 'polling', ...FASKES_POLLING, cadangan: 'Mau jenis tertentu? Ketik: *apotek*, *puskesmas*, *klinik*, atau *rs*.' },
    ];
  }
  return [{ tipe: 'teks', teks }];
}

function buatPenerima({ client, handle, log = console, waktu = Date.now, interaktif = false, polling: pakaiPolling = false, Poll = null, MessageMedia = null, banner = null }) {
  const antrean = new Map();
  const terlihat = new Map();
  const polling = new Map(); // id pesan polling → { chatId, nilai[] }
  const TTL = 10 * 60000;
  let media = null;
  const adaBanner = !!(banner && MessageMedia);

  function ambilBanner() {
    if (!media) media = MessageMedia.fromFilePath(banner);
    return media;
  }

  async function kirimSatu(chatId, item, kirimTeks) {
    if (item.tipe === 'teks') return kirimTeks(item.teks);
    try {
      if (item.tipe === 'gambar') {
        await client.sendMessage(chatId, ambilBanner(), { caption: item.caption });
        return;
      }
      if (item.tipe === 'polling' && Poll) {
        const terkirim = await client.sendMessage(chatId, new Poll(item.judul, item.opsi.map(o => o[0]), { allowMultipleAnswers: false }));
        const id = terkirim?.id?._serialized;
        if (id) {
          polling.set(id, { chatId, nama: item.opsi.map(o => o[0]), nilai: item.opsi.map(o => o[1]) });
          if (polling.size > 1000) polling.delete(polling.keys().next().value);
        }
        return;
      }
    } catch (e) {
      log.error(`Kirim ${item.tipe} gagal, memakai teks biasa.`);
    }
    return kirimTeks(item.cadangan);
  }

  async function proses(msg) {
    let chat;
    let mengirim = false;
    try {
      let input;
      if (msg.type === 'location' && msg.location) {
        input = { lokasi: { lat: Number(msg.location.latitude), lon: Number(msg.location.longitude), nama: msg.location.description || msg.location.name || '' } };
      } else if (msg.type === 'chat') input = { teks: msg.body };
      else {
        mengirim = true;
        await client.sendMessage(msg.from, 'Rara dapat membaca teks dan lokasi. Ketik *menu* untuk melihat layanan.', { linkPreview: false });
        return { status: 'unsupported' };
      }
      log.log('Pesan WhatsApp diterima'); // tanpa identitas dan isi kesehatan
      try { chat = await msg.getChat(); await chat.sendStateTyping(); } catch { /* @lid tetap dilayani */ }
      const kirim = async teks => {
        mengirim = true;
        await client.sendMessage(msg.from, teks, { linkPreview: false });
      };
      const balasan = await handle(msg.from, input, kirim);
      for (const teks of balasan) {
        for (const item of rencanaKiriman(teks, { interaktif, adaBanner, polling: pakaiPolling })) {
          mengirim = true;
          await kirimSatu(msg.from, item, kirim);
        }
      }
      return { status: 'sent' };
    } catch {
      log.error('Pemrosesan/pengiriman WhatsApp gagal; isi pesan tidak dicatat.');
      // Timeout kirim bisa berarti pesan sudah sampai. Jangan kirim ulang otomatis
      // melalui msg.reply karena dapat menghasilkan balasan ganda.
      if (!mengirim) {
        try { await client.sendMessage(msg.from, 'Maaf, terjadi gangguan. Silakan coba lagi sebentar lagi.', { linkPreview: false }); } catch {}
      }
      return { status: 'failed' };
    } finally {
      if (chat) { try { await chat.clearState(); } catch {} }
    }
  }

  function terima(msg) {
    if (msg.fromMe || !msg.from || msg.from.endsWith('@g.us') || msg.from.endsWith('@broadcast')) return Promise.resolve({ status: 'ignored' });
    const sekarang = waktu();
    for (const [id, waktuPesan] of terlihat) if (sekarang - waktuPesan > TTL) terlihat.delete(id);
    const id = msg.id?._serialized;
    if (id) {
      if (terlihat.has(id)) return Promise.resolve({ status: 'duplicate' });
      terlihat.set(id, sekarang);
      if (terlihat.size > 2000) terlihat.delete(terlihat.keys().next().value);
    }
    const sebelumnya = antrean.get(msg.from) || Promise.resolve();
    const tugas = sebelumnya.catch(() => {}).then(() => proses(msg));
    antrean.set(msg.from, tugas);
    const bersihkan = () => { if (antrean.get(msg.from) === tugas) antrean.delete(msg.from); };
    tugas.then(bersihkan, bersihkan);
    return tugas;
  }

  // Pilihan polling → diperlakukan sebagai pesan teks berisi nilai pilihan.
  function terimaPilihan(vote) {
    const pollId = vote?.parentMessage?.id?._serialized || vote?.parentMsgKey?._serialized;
    const info = pollId && polling.get(pollId);
    const dipilih = vote?.selectedOptions?.[0];
    if (!info || !dipilih) return Promise.resolve({ status: 'ignored' }); // polling lain / pilihan dibatalkan
    // Cocokkan berdasarkan nama opsi (lebih andal), localId hanya cadangan.
    let indeks = dipilih.name ? info.nama.indexOf(String(dipilih.name).trim()) : -1;
    if (indeks < 0 && Number.isInteger(dipilih.localId)) indeks = dipilih.localId;
    const nilai = info.nilai[indeks];
    if (nilai === undefined) return Promise.resolve({ status: 'ignored' });
    // WhatsApp bisa mengirim event yang sama berkali-kali (sinkron antarperangkat).
    // Satu polling hanya diproses sekali per pilihan dalam 60 detik.
    const sekarang = waktu();
    if (info.terakhir && info.terakhir.nilai === nilai && sekarang - info.terakhir.waktu < 60000) {
      return Promise.resolve({ status: 'duplicate' });
    }
    info.terakhir = { nilai, waktu: sekarang };
    log.log(`Pilihan polling diterima: ${nilai}`);
    return terima({
      from: info.chatId,
      type: 'chat',
      body: nilai,
      id: { _serialized: `pilih-${pollId}-${nilai}-${sekarang}` },
      getChat: async () => client.getChatById(info.chatId),
    });
  }

  terima.pilihan = terimaPilihan;
  return terima;
}

module.exports = { buatPenerima, rencanaKiriman, MENU_POLLING, FASKES_POLLING };