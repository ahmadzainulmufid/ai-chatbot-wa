const { Client, LocalAuth } = require('whatsapp-web.js');
const cfg = require('./src/config');
const login = require('./src/login');
const { handle } = require('./src/handler');
const { aiAktif } = require('./src/ai');

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'sehatku' }), // sesi login disimpan di folder .wwebjs_auth
  ...login.opsiClient(cfg.PAIRING_NUMBER), // tanpa QR bila PAIRING_NUMBER diisi
  puppeteer: {
    headless: true,
    executablePath: cfg.CHROME_PATH || undefined, // VPS: /usr/bin/google-chrome
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  },
});

login.pasang(client, { nomorMentah: cfg.PAIRING_NUMBER, port: cfg.PANEL_PORT, token: cfg.PANEL_TOKEN });

client.on('ready', () => {
  console.log(`\n✅ ${cfg.BOT_NAME} siap! AI: ${aiAktif() ? cfg.AI_PROVIDER : 'MATI (mode cadangan kata kunci)'}`);
});

client.on('auth_failure', (m) => console.error('❌ Login gagal:', m));
client.on('disconnected', (r) => console.log('⚠️ Terputus:', r));

const { buatPenerima } = require('./src/whatsapp');
client.on('message', buatPenerima({ client, handle }));

client.initialize();