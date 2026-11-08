// Transport diisolasi agar dapat diuji tanpa login atau mengirim ke WhatsApp asli.
function buatPenerima({ client, handle, log = console, waktu = Date.now }) {
  const antrean = new Map();
  const terlihat = new Map();
  const TTL = 10 * 60000;

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
      for (const teks of balasan) await kirim(teks);
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
  return terima;
}

module.exports = { buatPenerima };
