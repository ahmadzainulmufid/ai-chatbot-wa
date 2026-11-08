# Mutu percakapan dan pengujian Rara

Status: aturan teknis dan panduan umum awal. Belum ditinjau atau disahkan tenaga kesehatan. Filter pola tidak membuktikan jawaban benar atau aman secara klinis dan dapat menolak jawaban yang sebenarnya sesuai. Rara bukan layanan diagnosis atau pengganti triase darurat.

## Pertanyaan terarah

Catatan asesmen disimpan terpisah dari riwayat AI yang dibatasi. Aplikasi memilih satu pertanyaan lanjutan sesuai data kosong: skrining reaksi alergi bila relevan, usia, durasi, suhu untuk demam, skala nyeri kepala, gejala penyerta, riwayat/alergi obat, lalu penanganan yang sudah dicoba. Jawaban yang sudah terisi tidak ditanyakan lagi. Jawaban seperti belum diukur tetap dicatat; sistem tidak mengarang suhu. Informasi tambahan di luar pertanyaan tidak otomatis melengkapi semua kolom.

Usia, durasi, dan gejala yang disampaikan sejak awal dipakai kembali. Jawaban singkat ditafsirkan sesuai pertanyaan terakhir. Jawaban afirmatif pada skrining alergi diarahkan ke pesan darurat. Perintah menu dan penutup menghentikan pertanyaan yang menunggu, tanpa menghapus ringkasan. Keluhan baru/reset menghapus asesmen.

## Pemeriksaan jawaban

Prompt membatasi klaim diagnosis, resep, dosis personal, jaminan sembuh, dan pantangan makanan tanpa alasan individual. Sebelum dikirim dan disimpan sebagai jawaban AI, teks diperiksa terhadap pola diagnosis pasti, dosis, anjuran obat resep, pantangan tertentu, serta pembahasan obat sebelum asesmen cukup. Respons yang terdeteksi diganti panduan umum, bukan diteruskan mentah. Pertanyaan di teks AI diganti pertanyaan yang dipilih aplikasi. Catatan log berisi kategori kegagalan, bukan isi kesehatan.

Panduan awal menggunakan ringkasan sumber berikut; nomor darurat luar Indonesia dalam sumber tidak disalin ke bot:

- [NHS — demam dewasa](https://www.nhs.uk/symptoms/fever-in-adults/): istirahat, cairan, dan pemeriksaan bila memburuk atau tidak membaik.
- [CDC — penanganan common cold](https://www.cdc.gov/common-cold/treatment/index.html): perawatan gejala dan batas manfaat antibiotik untuk infeksi virus.
- [NHS — anafilaksis](https://www.nhs.uk/conditions/anaphylaxis/): tanda reaksi berat memerlukan pertolongan segera.
- [NHS — sakit kepala](https://www.nhs.uk/symptoms/headaches/): tanda bahaya dan kebutuhan penilaian medis.

Sebelum digunakan untuk layanan kesehatan nyata, tenaga kesehatan perlu meninjau seluruh template, pertanyaan, urgensi rujukan, kelompok rentan, kontraindikasi obat, penanganan negasi, dan contoh jawaban AI. Prioritaskan pengujian lokal yang relevan, termasuk dengue, kehamilan, bayi, serta penyakit kronis. Aturan saat ini tidak mencakup seluruh kondisi tersebut. Jangan menyebut modul ini tervalidasi klinis.

## Pengujian otomatis

Jalankan `npm.cmd test`. Tidak perlu login WhatsApp atau API key nyata. Tes meliputi:

- Percakapan utuh menu → konsultasi → suhu → riwayat → obat → penutup/menu → ringkasan.
- Informasi sudah diketahui, gejala disangkal, belum diukur, pertanyaan tidak relevan, reset, dan skrining alergi.
- Penggantian respons AI yang berisi diagnosis pasti, dosis, obat resep, atau pantangan yang ditolak aturan.
- Timeout AI, fallback model, HTTP 503, kuota, dan respons lambat tanpa pesan timer terlambat.
- Duplikasi ID pesan, antrean sampai seluruh balasan selesai dikirim, pengguna berbeda berjalan bersamaan, kegagalan kirim, pemulihan antrean, indikator mengetik yang gagal pada @lid, lokasi, media, grup, dan status.

Tes transport menggunakan objek WhatsApp tiruan yang menjalankan penerima yang sama dengan index.js; tes percakapan utuh juga memakai handler dan sesi asli. Ini tidak membuktikan koneksi akun WhatsApp, koneksi putus/sambung nyata, atau kebijakan platform telah terverifikasi.

## Batas pengiriman

Pengiriman berurutan per pengirim; pengguna lain tidak ikut menunggu. ID pesan dideduplikasi di memori selama 10 menit, maksimum 2.000 entri. Perlindungan ini tidak bertahan setelah restart. Kegagalan kirim yang statusnya tidak jelas tidak dicoba ulang otomatis melalui jalur lain agar tidak menggandakan pesan yang mungkin sudah sampai. Konsekuensinya, sebagian balasan dapat gagal diterima; log menandai kegagalan dan pesan baru tetap dapat diproses. Tidak ada janji pengiriman tepat satu kali.

Antrean tetap dapat menunda pesan berikutnya ketika respons sebelumnya lambat. Bot tidak boleh diandalkan untuk keadaan darurat. Tidak ada pengujian yang mengirim pesan ke kontak nyata dalam perubahan ini.
