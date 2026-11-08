// Tes satu permintaan pendek, tanpa data kesehatan atau nomor WhatsApp.
const cfg = require('../src/config');
const modelArg = process.argv.find(arg => arg.startsWith('--model='));
if (modelArg) cfg.GEMINI_MODEL = modelArg.slice('--model='.length);
const { aiAktif, tanyaAI } = require('../src/ai');

async function main() {
  if (!aiAktif()) {
    console.error('API key belum diisi untuk penyedia AI yang dipilih.');
    process.exitCode = 1;
    return;
  }
  if (process.argv.includes('--models')) {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
      headers: { 'x-goog-api-key': cfg.GEMINI_API_KEY }, signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log((data.models || []).filter(m => m.supportedGenerationMethods?.includes('generateContent') && /flash/.test(m.name) && !/image|tts|live|audio/.test(m.name)).map(m => m.name).join('\n'));
    return;
  }
  console.log(`Menguji ${cfg.AI_PROVIDER}; batas waktu ${cfg.AI_TIMEOUT_MS / 1000} detik. API key tidak ditampilkan.`);
  if (cfg.AI_PROVIDER === 'gemini') console.log(`Maksimal ${cfg.GEMINI_ATTEMPT_TIMEOUT_MS / 1000} detik per model, paling banyak 2 model.`);
  const mulai = Date.now();
  console.log(`Model: ${cfg.AI_PROVIDER === 'gemini' ? cfg.GEMINI_MODEL : cfg.ANTHROPIC_MODEL}`);
  const pesan = process.argv.includes('--konsultasi')
    ? 'Contoh pasien fiktif untuk pengujian: batuk ringan sejak dua hari, usia 30 tahun. Tidak demam dan tidak sesak. Apa informasi tambahan yang diperlukan?'
    : 'Halo Rara. Balas sapaan singkat dengan format JSON sesuai instruksi sistem.';
  const hasil = await tanyaAI([], pesan, 'konsultasi');
  console.log(`Durasi: ${((Date.now() - mulai) / 1000).toFixed(1)} detik.`);
  if (!hasil) {
    console.error('GAGAL: belum menerima jawaban AI yang valid. Lihat kode HTTP/timeout di atas; periksa koneksi, kuota, dan konfigurasi.');
    process.exitCode = 1;
    return;
  }
  console.log('BERHASIL: AI mengembalikan respons valid.');
}
main().catch(() => { console.error('Pemeriksaan AI gagal.'); process.exitCode = 1; });
