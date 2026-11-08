// Uji bot di terminal tanpa WhatsApp.  Jalankan: npm run simulasi
// Kirim lokasi dengan perintah:  /lokasi -6.4846,106.8773
// Keluar: /keluar
const readline = require('readline');
const { handle } = require('./src/handler');
const { aiAktif } = require('./src/ai');
const cfg = require('./src/config');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ID = 'simulasi@c.us';

console.log(`=== Simulasi ${cfg.BOT_NAME} (AI: ${aiAktif() ? cfg.AI_PROVIDER : 'mode cadangan'}) ===`);
console.log('Ketik pesan seperti di WhatsApp. Kirim lokasi: /lokasi lat,lon   Keluar: /keluar\n');

function tanya() {
  rl.question('Anda > ', async (baris) => {
    const t = baris.trim();
    if (t === '/keluar') return rl.close();
    let input = { teks: t };
    const m = t.match(/^\/lokasi\s+(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (m) input = { lokasi: { lat: parseFloat(m[1]), lon: parseFloat(m[2]) } };
    const balasan = await handle(ID, input);
    for (const b of balasan) console.log(`\n${cfg.BOT_NAME} > ${b}\n`);
    tanya();
  });
}
tanya();
