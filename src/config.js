require('dotenv').config();
const batasAI = Number(process.env.AI_TIMEOUT_MS || 45000);

module.exports = {
  AI_PROVIDER: (process.env.AI_PROVIDER || 'gemini').toLowerCase(),
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  GEMINI_FALLBACK_MODEL: process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.1-flash-lite',
  GEMINI_ATTEMPT_TIMEOUT_MS: 12000,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',

  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || '', 

  // Login WhatsApp
  PAIRING_NUMBER: process.env.PAIRING_NUMBER || '', // diisi → login dengan kode tautan, tanpa QR
  PANEL_PORT: parseInt(process.env.PANEL_PORT || '0', 10) || 0, // 0 = halaman web login mati
  PANEL_TOKEN: process.env.PANEL_TOKEN || '',
  CHROME_PATH: process.env.CHROME_PATH || '', // VPS: /usr/bin/google-chrome
  // MENU_INTERAKTIF=true → sapaan pertama memakai banner gambar (menu angka di keterangannya).
  MENU_INTERAKTIF: !/^(false|0|tidak|no)$/i.test(process.env.MENU_INTERAKTIF || 'true'),
  // MENU_POLLING=true (bawaan) → menu dikirim sebagai polling yang bisa diketuk. false → menu angka.
  MENU_POLLING: !/^(false|0|tidak|no)$/i.test(process.env.MENU_POLLING || 'true'),
  // Gambar banner sapaan pertama (relatif terhadap folder proyek).
  BANNER_FILE: process.env.BANNER_FILE || 'assets/banner-selaras.jpg',

  BOT_NAME: process.env.BOT_NAME || 'Rara',
  AI_TIMEOUT_MS: Number.isFinite(batasAI) && batasAI >= 5000 && batasAI <= 120000 ? Math.round(batasAI) : 45000,
  RADIUS_METER: parseInt(process.env.RADIUS_METER || '3000', 10),
  MAX_HASIL: parseInt(process.env.MAX_HASIL || '5', 10),
  SESSION_TIMEOUT_MENIT: parseInt(process.env.SESSION_TIMEOUT_MENIT || '30', 10),
  MAX_HISTORY: 16,
};