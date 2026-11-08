const cfg = require('./config');

const MENU = `Pilih layanan yang Anda butuhkan (balas angkanya):

*1.* 🩺 Konsultasi Kesehatan
*2.* 💡 Rekomendasi Solusi Keluhan
*3.* 📍 Cari Klinik / Puskesmas / Apotek Terdekat
*4.* 🚑 Nomor Darurat
*5.* 📋 Ringkasan Konsultasi
*6.* ℹ️ Tentang Rara & Privasi

Langsung ceritakan keluhan juga boleh. 😊
Perintah: *menu*, *selesai*, *keluhan baru*, *hapus data*.
Saat konsultasi, balas *usia 25* atau *nyeri 3/10* agar angka tidak dianggap pilihan menu.`;

const SAPAAN = `Halo, Salam Sehat! 👋 Saya *${cfg.BOT_NAME} — Rawat Raga*, asisten AI kesehatan di Sehatku.

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

const TENTANG = `🌿 *Rara — Rawat Raga*
Asisten AI Sehatku untuk tanya jawab kesehatan, perawatan awal, dan pencarian fasilitas kesehatan.

Rara bukan dokter. Diagnosis, resep, jadwal dokter, pemesanan konsultasi, pembayaran, serta pengantaran obat belum tersedia. Hubungi fasilitas yang ditemukan untuk layanan tersebut.`;

const MINTA_LOKASI = (jenis) => `Baik, saya carikan ${jenis === 'semua' ? 'klinik, puskesmas, apotek & RS' : jenis} terdekat. 📍

Silakan *kirim lokasi* Anda:
📎 (Lampiran) → *Lokasi* → *Kirim lokasi Anda saat ini*

Atau ketik nama daerah/alamat, contoh: _Citeureup Bogor_ atau _Jl. Margonda Depok_.

Mau jenis tertentu? Ketik: *apotek*, *puskesmas*, *klinik*, atau *rs*.`;

const RE_DARURAT = /(nyeri|sakit) (di )?dada|dada\b.{0,20}\b(nyeri|sakit|sesak|tertekan|ditekan)|dada (sesak|tertekan|nyeri)|sesak (napas|nafas) (berat|parah|hebat)|tidak bisa (bernapas|bernafas|napas|nafas)|pingsan|tidak sadar|kejang|stroke|bicara pelo|wajah (mencong|miring)|lumpuh (mendadak|sebelah)|perdarahan (hebat|banyak)|pendarahan (hebat|banyak)|muntah darah|keracunan|overdosis|digigit ular|kecelakaan/i;
const RE_KRISIS = /bunuh diri|ingin mati|pengen mati|pengin mati|mau mati aja|mengakhiri hidup|akhiri hidup|menyakiti diri|self ?harm/i;
const RE_TERIMA_KASIH = /^(terima ?kasih|makasih|trims|thanks|thank you|ok(e|ey)?|sip|siap|baik)\b/i;
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

module.exports = { MENU, SAPAAN, DARURAT, KRISIS_JIWA, TENTANG, MINTA_LOKASI, RE_DARURAT, RE_KRISIS, RE_SAPA, RE_TERIMA_KASIH, deteksiJenisFaskes, adalahPenutup };
