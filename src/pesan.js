const cfg = require('./config');

// Urutan menu = urutan pilihan polling (lihat MENU_POLLING di whatsapp.js).
const MENU = `Pilih layanan yang Anda butuhkan (balas angkanya):

*1.* 🩺 Konsultasi Kesehatan
*2.* 📋 Ringkasan Kesehatan
*3.* 📍 Cari Klinik / Apotek
*4.* 🚑 Nomor Darurat
*5.* 🌬️ Udara Saat Ini
*6.* 🙋‍♀️ About Me
*7.* ❤️ Tips Hidup Sehat

Langsung ceritakan keluhan apa pun juga boleh. 😊
Perintah: *menu*, *ringkasan*, *keluhan baru*, *privasi*.
Saat konsultasi, balas *usia 25* atau *nyeri 3/10* agar angka tidak dianggap pilihan menu.`;

const SAPAAN = `Halo, Aku *${cfg.BOT_NAME}*! 👋 *Virtual Assistant #SELARAS* yang siap menemani kamu 24 jam.

${MENU}

_${cfg.BOT_NAME} membantu informasi awal & bukan pengganti pemeriksaan dokter._`;

const DARURAT = `🚑 *KONDISI DARURAT — segera cari pertolongan!*

• Ambulans / Gawat darurat: *119*
• Panggilan darurat umum: *112*
• Langsung ke *IGD rumah sakit* terdekat

Jangan menunggu balasan chat. Bila memungkinkan, minta orang di sekitar Anda menemani.
Ketik *3* lalu kirim lokasi untuk mencari rumah sakit terdekat.`;

const KRISIS_JIWA = `Saya ikut prihatin Anda sedang merasa seberat ini. 💙 Anda tidak sendirian, dan perasaan ini bisa dibantu.

Jika Anda dalam bahaya sekarang, segera datangi IGD terdekat dan minta orang yang dipercaya menemani. Jauhkan benda yang dapat melukai diri bila aman dilakukan.

Kalau bisa, kabari orang yang Anda percaya untuk menemani sekarang. Saya tetap di sini kalau Anda mau bercerita.`;

const TENTANG = `ℹ️ *Privasi & Batasan Rara*
Rara adalah asisten AI untuk tanya jawab kesehatan, info kualitas udara, tips hidup sehat, dan pencarian fasilitas kesehatan.

Rara bukan dokter. Diagnosis, resep, jadwal dokter, pemesanan konsultasi, pembayaran, serta pengantaran obat belum tersedia. Hubungi fasilitas yang ditemukan untuk layanan tersebut.
Catatan konsultasi hanya disimpan sementara (hilang setelah 30 menit tidak aktif). Ketik *hapus data* untuk menghapusnya sekarang.`;

const KONSULTASI = `🩺 *Konsultasi Kesehatan*

Ceritakan keluhan Anda: apa yang dirasakan, *sejak kapan*, dan *usia* Anda. Semua keluhan boleh ditanyakan, termasuk keluhan pernapasan seperti batuk, pilek, sesak, atau asma kambuh.
Contoh: _"Batuk berdahak sejak 3 hari, usia 22 tahun."_
🚨 Bila sesak berat, bibir kebiruan, atau nyeri dada, segera ke IGD / hubungi *119*.`;

const TIPS = `❤️ *Tips Hidup Sehat ala Rara*

🌬️ *Jaga paru-paru*
• Cek kualitas udara sebelum beraktivitas di luar (ketik *5*). Saat udara tidak sehat, kurangi aktivitas berat di luar.
• Pakai masker yang rapat (KN95/N95) saat polusi tinggi; masker kain kurang efektif menyaring PM2.5.
• Jauhi asap rokok dan pembakaran sampah. Berhenti merokok adalah langkah terbaik untuk paru-paru.
• Jaga ventilasi rumah: buka jendela saat udara baik, tutup saat polusi tinggi.

🏃 *Bergerak & istirahat*
• Aktivitas fisik intensitas sedang ±150 menit per minggu (mis. jalan cepat 30 menit, 5 hari).
• Tidur cukup, sekitar 7–9 jam untuk orang dewasa.

🥗 *Makan & minum*
• Perbanyak sayur dan buah, kurangi gula, garam, dan lemak berlebih.
• Minum air putih yang cukup sepanjang hari.

🧼 *Cegah penularan*
• Cuci tangan dengan sabun, tutup mulut saat batuk/bersin, pakai masker saat sakit.

Mau tips khusus? Tanyakan saja, misalnya _"tips olahraga saat polusi"_ atau _"tips tidur nyenyak"_.`;

const MINTA_LOKASI_UDARA = `🌬️ *Info Kualitas Udara*

Silakan *kirim lokasi* Anda:
📎 (Lampiran) → *Lokasi* → *Kirim lokasi Anda saat ini*

Atau ketik nama daerah, contoh: _Depok_, _Cilodong Depok_, atau _Jakarta Selatan_.`;

const MINTA_LOKASI = (jenis) => `Baik, saya carikan ${jenis === 'semua' ? 'klinik, puskesmas, apotek & RS' : jenis} terdekat. 📍

Silakan *kirim lokasi* Anda:
📎 (Lampiran) → *Lokasi* → *Kirim lokasi Anda saat ini*

Atau ketik nama daerah/alamat, contoh: _Citeureup Bogor_ atau _Jl. Margonda Depok_.

Mau jenis tertentu? Ketik: *apotek*, *puskesmas*, *klinik*, atau *rs*.`;

const RE_DARURAT = /(nyeri|sakit) (di )?dada|dada\b.{0,20}\b(nyeri|sakit|sesak|tertekan|ditekan)|dada (sesak|tertekan|nyeri)|sesak (napas|nafas) (berat|parah|hebat)|tidak bisa (bernapas|bernafas|napas|nafas)|pingsan|tidak sadar|kejang|stroke|bicara pelo|wajah (mencong|miring)|lumpuh (mendadak|sebelah)|perdarahan (hebat|banyak)|pendarahan (hebat|banyak)|muntah darah|keracunan|overdosis|digigit ular|kecelakaan/i;
const RE_KRISIS = /bunuh diri|ingin mati|pengen mati|pengin mati|mau mati aja|mengakhiri hidup|akhiri hidup|menyakiti diri|self ?harm/i;
const RE_TERIMA_KASIH = /^(terima ?kasih|makasih|trims|thanks|thank you|ok(e|ey)?|sip|siap|baik)\b/i;
const RE_UDARA = /kualitas udara|polusi(?: udara)?|\baqi\b|\bispu\b|indeks udara|udara (?:hari ini|sekarang|di)/i;
const RE_SAPA = /^(hai|halo|hallo|hi|hello|p|ping|assalamu|selamat (pagi|siang|sore|malam)|mulai|start|menu)\b/i;

function adalahPenutup(teks) {
  const t = teks.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const adaTerimaKasih = /\b(terima\s*kasih|makasih|makasi|trims|thanks|thank you)\b/.test(t);
  if (adaTerimaKasih) {
    return /^(?:(?:terima kasih|terimakasih|makasih|makasi|trims|thanks|thank you|tidak ada lagi|tidak ada|nggak ada|ngga ada|gak ada|ga ada|sudah cukup|udah cukup|cukup dulu|itu saja|sudah|udah|cukup|lagi|banyak|rara|kak|ya|yah|iya|baik|oke|ok|sip|siap)\s*)+$/.test(t);
  }
  return /^(oke|ok|sip|siap|baik|cukup(?: dulu)?|sudah cukup|udah cukup|itu saja|tidak ada lagi)(?: rara)?$/.test(t);
}

function deteksiJenisFaskes(teks) {
  const t = teks.toLowerCase();
  if (/\b(apotek|apotik)\b/.test(t)) return 'apotek';
  if (/puskesmas/.test(t)) return 'puskesmas';
  if (/rumah sakit|\brs\b|igd|ugd/.test(t)) return 'rs';
  if (/\bklinik\b|cari dokter/.test(t)) return 'klinik';
  return null;
}

module.exports = { MENU, SAPAAN, DARURAT, KRISIS_JIWA, TENTANG, KONSULTASI, PERNAPASAN: KONSULTASI, TIPS, MINTA_LOKASI_UDARA, RE_UDARA, MINTA_LOKASI, RE_DARURAT, RE_KRISIS, RE_SAPA, RE_TERIMA_KASIH, deteksiJenisFaskes, adalahPenutup };