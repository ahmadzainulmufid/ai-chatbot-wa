# Rara — Rawat Raga
Asisten AI kesehatan WhatsApp pada layanan Sehatku. Prototipe konsultasi awal dengan alur layanan seperti aplikasi kesehatan: percakapan keluhan, panduan perawatan awal, dan pencarian fasilitas. Rara bukan dokter dan tidak menyediakan diagnosis, resep, booking dokter, pembayaran, atau pengantaran obat.

## Menjalankan
Kebutuhan: Node.js 18+ dan nomor WhatsApp untuk bot.
1. Jalankan `npm.cmd install` di Windows.
2. Untuk instalasi baru, salin `.env.example` menjadi `.env`. Jangan menimpa API key instalasi yang sudah ada.
3. Isi `GEMINI_API_KEY`, gunakan `AI_PROVIDER=gemini`, `GEMINI_MODEL=gemini-3.5-flash-lite`, `GEMINI_FALLBACK_MODEL=gemini-3.1-flash-lite`, dan `BOT_NAME=Rara`.
4. Jalankan `npm.cmd run simulasi` untuk percakapan di terminal atau `npm.cmd start` untuk WhatsApp, lalu scan QR perangkat tertaut.
5. Setelah mengubah kode atau .env, hentikan proses bot lama dengan Ctrl+C dan jalankan ulang. Jangan jalankan dua proses WhatsApp dengan sesi login yang sama.

Di Linux/macOS gunakan `npm`. Tidak perlu mengganti API key hanya karena model mendapat 404. Model utama Gemini adalah Flash-Lite 3.5 dan cadangannya Flash-Lite 3.1. Setelah timeout, gangguan jaringan, HTTP 404, atau HTTP 500/502/503/504, kode mencoba model cadangan satu kali dengan konteks yang sama. Error auth/kuota tidak diulang. Tiap model mendapat maksimal 12 detik, termasuk membaca body respons: dua percobaan biasanya dibatasi sekitar 24 detik, ditambah penjadwalan proses. AI_TIMEOUT_MS membatasi total waktu (default 45 detik, nilai valid 5.000–120.000 ms); menaikkannya tidak memperpanjang batas 12 detik per model. Saat menunggu AI, bot memakai indikator mengetik WhatsApp tanpa notifikasi timer terpisah agar tidak ada pesan menunggu yang muncul setelah jawaban. Jika kedua model gagal, Rara memakai panduan umum dengan pemberitahuan.
Dokumentasi: [Gemini generateContent](https://ai.google.dev/api/generate-content).

## Menu dan perintah
| Input | Layanan |
|---|---|
| 1 | Konsultasi: keluhan, usia, durasi, gejala penyerta |
| 2 | Penanganan awal |
| 3 | Cari klinik, puskesmas, apotek, rumah sakit |
| 4 | Informasi darurat |
| 5 / ringkasan / selesai | Ringkasan keterangan pengguna; selesai tidak menghapus sesi |
| 6 / tentang / privasi / bantuan | Identitas, kemampuan, privasi |
| menu / 0 | Kembali ke menu dengan catatan konsultasi tetap tersedia |
| keluhan baru / reset / hapus data | Menghapus sesi bot dan memulai ulang |

Angka 1–6 dan 0 selalu perintah menu. Jawab usia dengan *usia 3 tahun*, durasi dengan *3 hari*, dan skala dengan *nyeri 3/10*. Keluhan baru milik orang lain sebaiknya diawali *keluhan baru* agar konteks tidak tercampur.

Contoh:
- `Sudah 3 hari sakit kepala sebelah, kadang mual, usia 25`
- `Gatal dan bentol setelah makan udang, mulai 1 jam lalu, usia 25`
- `cari klinik di Cilodong Depok`, lalu `apotek` untuk memakai lokasi sebelumnya
- Kirim lokasi WhatsApp lewat Lampiran → Lokasi. Simulasi: `/lokasi -6.4846,106.8773`

## Perilaku layanan
- Percakapan AI menggali 1–2 pertanyaan, mempertimbangkan riwayat, memberi kemungkinan umum, langkah awal, dan batas pemeriksaan.
- Mode cadangan mempertahankan keluhan dan menggali usia/durasi. Panduan ini terbatas dan tidak menggantikan triase tenaga medis.
- Tanda bahaya tertentu ditangani sebelum AI, termasuk bengkak lidah/bibir dan sulit bernapas. Deteksi kata kunci dapat melewatkan atau salah menafsirkan pesan; jangan mengandalkan bot untuk keadaan darurat.
- Pencarian fasilitas berjalan tanpa AI: Google Places opsional, Nominatim/Overpass sebagai sumber lain, lalu tautan Maps jika data kosong/gagal. Google mendapat 0 hasil bukan berarti semua sumber gagal.
- Jenis fasilitas dapat diganti tanpa mengirim lokasi ulang. Alamat daerah memakai pusat daerah; koordinat GPS menampilkan perkiraan jarak garis lurus. Jam buka dan kelengkapan data perlu dikonfirmasi kepada fasilitas.
- Pesan per pengirim diproses berurutan untuk menjaga konteks. Riwayat AI dibatasi; catatan pengguna pada ringkasan menyimpan paling banyak 30 pesan.

## Privasi dan batas operasional
Riwayat bot hanya di memori dan dibersihkan setelah 30 menit tidak aktif (dapat diatur melalui SESSION_TIMEOUT_MENIT). Reset/restart menghapus catatan bot, bukan pesan pada WhatsApp atau data yang telah diterima penyedia.
Isi percakapan dikirim ke penyedia AI sesuai konfigurasi. Alamat/koordinat dipakai oleh penyedia pencarian Google/OSM. Jangan mengirim NIK, informasi pembayaran, atau dokumen pribadi.
Log pesan masuk tidak menampilkan nomor atau isi keluhan. Jangan mempublikasikan .env, .wwebjs_auth, atau .wwebjs_cache.
whatsapp-web.js memakai otomasi WhatsApp Web. Untuk layanan produksi perlu evaluasi kebijakan Meta, integrasi WhatsApp Business Cloud API, tinjauan klinis, pengamanan data, dan sistem rujukan tenaga kesehatan.

## Berkas utama dan pengujian
- index.js: koneksi WhatsApp dan pengiriman pesan
- src/handler.js: menu, antrean per pengguna, konsultasi dan pencarian
- src/konsultasi.js: pencatatan, ringkasan, skrining lokal, percakapan cadangan
- src/ai.js: prompt Rara, Gemini/Claude, timeout dan migrasi model
- src/session.js: sesi sementara dan kedaluwarsa
- src/faskes.js: pencarian fasilitas nyata
- src/asesmen.js: pertanyaan lanjutan berdasarkan data yang belum terisi
- src/mutu.js: filter pola respons AI dan penyusunan pertanyaan terarah
- src/whatsapp.js: antrean sampai pengiriman selesai serta deduplikasi event
- src/pesan.js dan src/fallback.js: template serta panduan umum
- test/bot.test.js: regresi alur tanpa koneksi WhatsApp/API asli
- test/konsultasi.test.js, test/whatsapp.test.js, test/percakapan-whatsapp.test.js: asesmen, filter mutu, transport, dan percakapan utuh

Rincian sumber panduan, cakupan pengujian, dan keterbatasan tersedia di [Mutu dan Pengujian](docs/MUTU-DAN-PENGUJIAN.md). Aturan medis belum mendapat peninjauan klinis. Pengiriman WhatsApp diuji dengan simulasi yang memakai transport dan handler asli; perubahan ini tidak mengirim pesan ke kontak nyata.

Jalankan `npm.cmd test`. API AI dan pencarian diganti tiruan dalam pengujian, sehingga hasil tes bukan bukti bahwa key, kuota, pencarian eksternal, atau koneksi WhatsApp aktif.

Referensi skrining: [NHS — anaphylaxis](https://www.nhs.uk/conditions/anaphylaxis/) dan [NHS — headaches](https://www.nhs.uk/symptoms/headaches/).

## Pemeriksaan koneksi AI
Jalankan `npm.cmd run cek-ai` untuk menguji satu sapaan singkat ke penyedia AI aktif. Pemeriksaan ini memanggil API asli dan memakai kuota; tidak mengirim keluhan atau nomor WhatsApp dan tidak menampilkan API key. Hasil menampilkan durasi serta status respons valid. Mode cadangan mengenali durasi seperti sejak kemarin, tadi pagi, semalam, hari ini, dan barusan.
Referensi: [Gemini thinking](https://ai.google.dev/gemini-api/docs/generate-content/thinking).

Opsi diagnostik: `npm.cmd run cek-ai -- --models` menampilkan daftar model teks dari API (daftar bukan jaminan model dapat dipanggil); `npm.cmd run cek-ai -- --konsultasi` menguji contoh konsultasi fiktif; `npm.cmd run cek-ai -- --model=gemini-3.5-flash-lite --konsultasi` memilih model untuk tes tanpa mengubah .env. Log menyebut model yang benar-benar menjawab. Ketersediaan dan latensi tetap bergantung pada penyedia serta jaringan.

Ucapan penutup seperti 'tidak ada Rara, terimakasih', 'terima kasih Rara', atau 'cukup dulu' dibalas langsung dengan penutup dan menu dalam satu pesan tanpa memanggil AI. Mode konsultasi ditutup, catatan ringkasan tetap tersedia. Ucapan terima kasih yang masih mengandung pertanyaan atau keluhan tetap diproses sebagai percakapan.
