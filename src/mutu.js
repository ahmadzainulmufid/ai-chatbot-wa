function periksa(reply, s) {
  const alasan = [];
  if (typeof reply !== 'string' || !reply.trim() || reply.length > 2400) return ['format'];
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

// Urutan balasan:
// - Masih menggali informasi : tanggapan singkat → pertanyaan berikutnya (tanpa peringatan berulang)
// - Informasi sudah cukup    : kemungkinan penyebab & anjuran → peringatan/CTA IGD di paling bawah
const PERINGATAN = '⚠️ Jika keluhan memburuk atau tidak membaik, hubungi tenaga kesehatan. Jika sulit bernapas atau kesadaran menurun, segera ke IGD.';

function susun(reply, pertanyaan) {
  const isi = reply.replace(/[^.!?\n]*\?/g, '').trim();
  if (pertanyaan) {
    const tanggapan = isi || 'Terima kasih, informasinya sudah Rara catat.';
    return tanggapan + '\n\n' + pertanyaan;
  }
  const aman = isi || 'Terima kasih sudah memberi informasi. Rara membantu informasi awal dan belum dapat memastikan penyebab keluhan.';
  const peringatan = /IGD|gawat darurat|119/i.test(aman) ? '' : '\n\n' + PERINGATAN;
  return aman + peringatan + '\n\nKetik *ringkasan* untuk melihat catatan atau *3* untuk mencari fasilitas kesehatan.';
}

module.exports = { periksa, susun };