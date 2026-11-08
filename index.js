// Entry point: menghubungkan bot ke WhatsApp memakai whatsapp-web.js (login dengan scan QR).
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cfg = require('./src/config');
const { handle } = require('./src/handler');
const { aiAktif } = require('./src/ai');

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'sehatku' }), // sesi login disimpan di folder .wwebjs_auth
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

client.on('qr', (qr) => {
  console.log('\nScan QR ini di WhatsApp → Perangkat tertaut → Tautkan perangkat:\n');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log(`\n✅ ${cfg.BOT_NAME} siap! AI: ${aiAktif() ? cfg.AI_PROVIDER : 'MATI (mode cadangan kata kunci)'}`);
});

client.on('auth_failure', (m) => console.error('❌ Login gagal:', m));
client.on('disconnected', (r) => console.log('⚠️ Terputus:', r));

const { buatPenerima } = require('./src/whatsapp');
client.on('message', buatPenerima({ client, handle }));

client.initialize();
