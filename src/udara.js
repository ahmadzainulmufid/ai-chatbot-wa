function periksa(reply, s) {
  const alasan = [];
  if (typeof reply !== 'string' || !reply.trim() || reply.length > 4000) return ['format'];
  if (/\b(pasti|dipastikan|dijamin sembuh)\b|(?:diagnosis|diagnosa)\s+(?:anda\s+)?(?:adalah|pasti)|(?:anda|kamu|kakak)\s+(?:menderita|terkena)\s+/i.test(reply)) alasan.push('kepastian diagnosis');
  if (/\b\d+(?:[.,]\d+)?\s*(?:mg|ml|tablet|kapsul)\b|\b\d+\s*(?:x|kali)\s*(?:sehari|per hari)/i.test(reply)) alasan.push('dosis personal');
  for (const kalimat of reply.split(/[.!?\n]/)) {
    if (/antibiotik|amoksisilin|amoxicillin|azitromisin|azithromycin|dexamethasone|deksametason|prednison|prednisone|diazepam/i.test(kalimat) &&
        !/jangan|tidak (?:perlu|boleh|disarankan)|dokter|resep/i.test(kalimat)) alasan.push('obat resep');
  }
  if (/(?:hindari|dilarang|jangan (?:makan|minum)|pantang)[^.\n]{0,80}(?:gorengan|makanan manis|air dingin|minuman dingin)/i.test(reply)) alasan.push('pantangan tanpa dasar');
  if (/tidak perlu (?:ke |periksa |menemui )?dokter|cukup di rumah saja|aman untuk semua|istirahat total/i.test(reply)) alasan.push('jaminan atau anjuran berlebihan');
  const umur = s.profil.usia || '';
  const dewasa = /^\d+ tahun$/.test(umur) && Number(umur.split(' ')[0]) >= 18;
  if (/parasetamol|paracetamol|ibuprofen|antasida|antihistamin/i.test(reply) &&
      (!dewasa || !s.asesmen?.risiko || !s.asesmen?.obat || /hamil|menyusui/.test(s.asesmen.risiko))) alasan.push('obat sebelum asesmen cukup');
  return [...new Set(alasan)];
}

// Susunan balasan Rara:
//   Tahap menggali     : tanggapan singkat → pertanyaan berikutnya (tanpa peringatan berulang)
//   Tahap rekomendasi  : pembuka → 📋 data keluhan → 🔍 kemungkinan penyebab → ✅ yang bisa dilakukan sekarang
//                        → 🩺 kapan ke dokter → 🚨 tanda bahaya / CTA IGD (paling bawah) → menu lanjutan
const PERINGATAN = '⚠️ Jika keluhan memburuk atau tidak membaik, hubungi tenaga kesehatan. Jika sulit bernapas atau kesadaran menurun, segera ke IGD.';
const BAHAYA_UMUM = [
  'Sesak napas, napas berat, atau bibir kebiruan',
  'Nyeri dada atau jantung berdebar hebat',
  'Pingsan, sangat lemas, atau kesadaran menurun',
  'Keluhan memburuk dengan cepat',
];
const PENUTUP = '_Rara memberi informasi awal, bukan diagnosis dokter._\nKetik *ringkasan* untuk catatan keluhan, *3* untuk cari faskes terdekat, atau *menu*.';

const tanpaPertanyaan = (t) => String(t || '').replace(/[^.!?\n]*\?/g, '').trim();
const potong = (t, n) => (t.length > n ? t.slice(0, n - 1).trim() + '…' : t);

function dataKeluhan(s) {
  if (!s) return [];
  const p = s.profil || {}, a = s.asesmen || {};
  return [
    p.usia && `Usia: ${p.usia}`,
    p.durasi && `Durasi: ${p.durasi}`,
    a.suhu && `Suhu: ${a.suhu.replace(' (keterangan pengguna)', '')}`,
    p.nyeri && `Skala nyeri: ${p.nyeri}`,
    a.obat && `Sudah dicoba: ${/^(?:tidak(?: ada)?|belum(?: ada| minum obat)?|nggak|gak|ga)$/i.test(a.obat.trim()) ? 'belum ada obat/penanganan' : potong(a.obat, 60)}`,
  ].filter(Boolean);
}

/**
 * Menyusun jawaban akhir yang lengkap. Dipakai untuk balasan AI maupun mode cadangan.
 * @param {object} r { pembuka, judul, penyebab, anjuran[], keDokter, tandaBahaya[], pertanyaan, s }
 */
function formatRekomendasi(r) {
  const bagian = [];
  if (r.pembuka) bagian.push(r.pembuka);
  if (r.judul) bagian.push(r.judul);
  const data = dataKeluhan(r.s);
  if (data.length) bagian.push('📋 *Data keluhan*\n' + data.map(d => '• ' + d).join('\n'));
  if (r.penyebab) bagian.push('🔍 *Kemungkinan penyebab*\n' + r.penyebab);
  if (r.anjuran?.length) bagian.push('✅ *Yang bisa dilakukan sekarang*\n' + r.anjuran.map(x => '• ' + x).join('\n'));
  if (r.keDokter) {
    const kd = r.keDokter.replace(/^(?:bila|jika|apabila|kalau)\s+/i, '');
    bagian.push('🩺 *Periksa ke dokter/puskesmas bila*\n' + kd.charAt(0).toUpperCase() + kd.slice(1));
  }
  if (r.pertanyaan) bagian.push(r.pertanyaan);
  const bahaya = r.tandaBahaya?.length ? r.tandaBahaya : BAHAYA_UMUM;
  bagian.push('🚨 *Segera ke IGD atau hubungi 119 bila:*\n' + bahaya.map(x => '• ' + x).join('\n'));
  bagian.push(PENUTUP);
  return bagian.join('\n\n');
}

/**
 * @param {string} reply       balasan utama AI
 * @param {string|null} pertanyaan  pertanyaan lanjutan dari aplikasi (null = data cukup)
 * @param {object} [rinci]     field terstruktur dari AI (penyebab, anjuran, ke_dokter, tanda_bahaya)
 * @param {object} [s]         sesi pengguna (untuk ringkasan data keluhan)
 */
function susun(reply, pertanyaan, rinci = null, s = null) {
  const isi = tanpaPertanyaan(reply);
  if (pertanyaan) {
    const tanggapan = isi || 'Terima kasih, informasinya sudah Rara catat.';
    return tanggapan + '\n\n' + pertanyaan;
  }
  if (rinci && (rinci.penyebab || rinci.anjuran?.length)) {
    return formatRekomendasi({
      pembuka: isi,
      penyebab: tanpaPertanyaan(rinci.penyebab),
      anjuran: (rinci.anjuran || []).map(tanpaPertanyaan).filter(Boolean),
      keDokter: tanpaPertanyaan(rinci.ke_dokter),
      tandaBahaya: (rinci.tanda_bahaya || []).map(tanpaPertanyaan).filter(Boolean),
      s,
    });
  }
  // AI tidak mengisi bagian terstruktur: tetap jaga urutan, peringatan di paling bawah.
  const aman = isi || 'Terima kasih sudah memberi informasi. Rara membantu informasi awal dan belum dapat memastikan penyebab keluhan.';
  const peringatan = /IGD|gawat darurat|119/i.test(aman) ? '' : '\n\n' + PERINGATAN;
  return aman + peringatan + '\n\nKetik *ringkasan* untuk melihat catatan atau *3* untuk mencari fasilitas kesehatan.';
}

module.exports = { periksa, susun, formatRekomendasi };