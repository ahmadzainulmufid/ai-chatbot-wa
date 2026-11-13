const http = require('http');
const crypto = require('crypto');
const qrTerminal = require('qrcode-terminal');

function normalisasiNomor(n) {
  let d = String(n || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  return d;
}

function formatKode(kode) {
  const k = String(kode || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return k.length === 8 ? `${k.slice(0, 4)}-${k.slice(4)}` : k;
}

/** Opsi tambahan untuk new Client({...}) */
function opsiClient(nomorMentah) {
  const nomor = normalisasiNomor(nomorMentah);
  if (!nomor) return {};
  return { pairWithPhoneNumber: { phoneNumber: nomor, showNotification: true, intervalMs: 180000 } };
}

function buatStatus() {
  return { keadaan: 'memulai', kode: null, kodeWaktu: 0, qr: null, info: '' };
}

function pasang(client, { nomorMentah = '', port = 0, token = '', log = console } = {}) {
  const nomor = normalisasiNomor(nomorMentah);
  const status = buatStatus();

  client.on('code', (kode) => {
    status.keadaan = 'menunggu_login';
    status.kode = formatKode(kode);
    status.kodeWaktu = Date.now();
    log.log(`\n🔑 KODE TAUTAN untuk +${nomor}:  ${status.kode}`);
    log.log('   Di HP nomor bot: WhatsApp → Perangkat tertaut → Tautkan perangkat →');
    log.log('   "Tautkan dengan nomor telepon saja" → masukkan kode di atas.');
    log.log('   (Kode diperbarui otomatis setiap ±3 menit.)\n');
  });

  client.on('qr', (qr) => {
    status.keadaan = 'menunggu_login';
    status.qr = qr;
    log.log('\n📷 Scan QR ini di WhatsApp → Perangkat tertaut → Tautkan perangkat:\n');
    qrTerminal.generate(qr, { small: true });
  });

  // Setelah scan/kode diterima, QR lama tidak boleh tampil lagi.
  client.on('authenticated', () => {
    status.keadaan = 'memuat';
    status.qr = status.kode = null;
    status.info = 'Login berhasil, memuat chat WhatsApp...';
    log.log('[Login] Login berhasil. Memuat chat WhatsApp, biarkan HP nomor bot tetap online...');
  });
  client.on('loading_screen', (persen) => {
    status.keadaan = 'memuat';
    status.qr = status.kode = null;
    status.info = `Memuat chat WhatsApp... ${persen}%`;
    log.log(`[Login] Memuat WhatsApp ${persen}%`);
  });
  client.on('ready', () => {
    status.keadaan = 'terhubung';
    status.kode = status.qr = null;
    status.info = 'WhatsApp bot terhubung.';
  });
  client.on('auth_failure', () => { status.keadaan = 'terputus'; status.info = 'Login gagal. Restart bot untuk mencoba lagi.'; });
  client.on('disconnected', (r) => { status.keadaan = 'terputus'; status.info = `Terputus (${r}). Restart bot untuk login ulang.`; });

  log.log(nomor
    ? `[Login] Mode kode tautan (tanpa QR) untuk nomor +${nomor}. Menunggu kode dari WhatsApp...`
    : '[Login] PAIRING_NUMBER kosong → login dengan scan QR.');

  const mintaKodeBaru = async () => {
    if (!nomor || status.keadaan === 'terhubung') return;
    try { await client.requestPairingCode(nomor, true); } catch (e) { log.warn('[Login] Gagal meminta kode baru:', e.message); }
  };

  const server = port ? mulaiPanel({ status, nomor, port, token, mintaKodeBaru, log }) : null;
  return { status, server };
}

// ---------------- Halaman web ----------------
function mulaiPanel({ status, nomor, port, token, mintaKodeBaru, log }) {
  if (!token) {
    token = crypto.randomBytes(6).toString('hex');
    log.log(`[Panel] PANEL_TOKEN kosong, token sementara: ${token}`);
  }
  const tokenBuf = Buffer.from(token);
  const tokenBenar = (t) => {
    const b = Buffer.from(String(t || ''));
    return b.length === tokenBuf.length && crypto.timingSafeEqual(b, tokenBuf);
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const kirim = (kode, tipe, isi) => {
      res.writeHead(kode, { 'Content-Type': tipe, 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' });
      res.end(isi);
    };
    if (!tokenBenar(url.searchParams.get('token'))) return kirim(401, 'text/html; charset=utf-8', halamanToken());
    if (url.pathname === '/status') {
      let qrSvg = null;
      if (status.qr) { try { qrSvg = await require('qrcode').toString(status.qr, { type: 'svg', margin: 2 }); } catch {} }
      return kirim(200, 'application/json', JSON.stringify({ keadaan: status.keadaan, kode: status.kode, qrSvg, info: status.info, nomor }));
    }
    if (url.pathname === '/kode-baru' && req.method === 'POST') {
      await mintaKodeBaru();
      return kirim(200, 'application/json', JSON.stringify({ ok: true }));
    }
    return kirim(200, 'text/html; charset=utf-8', halamanPanel());
  });
  server.listen(port, () => {
    log.log(`[Panel] Halaman login: http://localhost:${port}/?token=${token}`);
    log.log(`        Di VPS: http://IP-VPS:${port}/?token=${token}`);
  });
  server.on('error', (e) => log.warn(`[Panel] Tidak bisa membuka port ${port}: ${e.message}`));
  return server;
}

function halamanToken() {
  return `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rara — Login</title><body style="font-family:system-ui;background:#f0fdfa;display:grid;place-items:center;min-height:100vh;margin:0">
<form style="background:#fff;padding:24px;border-radius:16px;box-shadow:0 4px 20px #0001;max-width:320px;width:90%">
<h2 style="margin-top:0;color:#0f766e">Rara · Sehatku</h2><p>Masukkan token panel:</p>
<input name="token" type="password" autocomplete="off" style="width:100%;padding:10px;border:1px solid #ccc;border-radius:8px;box-sizing:border-box">
<button style="margin-top:12px;width:100%;padding:10px;border:0;border-radius:8px;background:#0d9488;color:#fff;font-weight:600">Masuk</button>
</form></body></html>`;
}

function halamanPanel() {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rara — Tautkan WhatsApp</title>
<style>
  body{font-family:system-ui,sans-serif;background:#f0fdfa;margin:0;padding:16px;color:#134e4a}
  .kartu{max-width:440px;margin:0 auto;background:#fff;border-radius:18px;padding:24px;box-shadow:0 6px 24px #0f766e1a}
  h1{font-size:22px;margin:0 0 4px;color:#0f766e}.sub{margin:0 0 18px;color:#5b7c79}
  .badge{display:inline-block;padding:4px 12px;border-radius:99px;font-size:13px;font-weight:600}
  .ok{background:#dcfce7;color:#166534}.tunggu{background:#fef9c3;color:#854d0e}.putus{background:#fee2e2;color:#991b1b}
  h2{font-size:16px;margin:22px 0 8px}.qr svg{display:block;width:260px;max-width:100%;margin:8px auto}
  .kode{font:700 34px/1.2 ui-monospace,monospace;letter-spacing:4px;text-align:center;background:#f0fdfa;border:2px dashed #14b8a6;border-radius:12px;padding:14px}
  ol{padding-left:20px;line-height:1.6;font-size:14px}button{padding:9px 14px;border:0;border-radius:8px;background:#0d9488;color:#fff;font-weight:600;cursor:pointer}
  .abu{color:#6b7280;font-size:13px}
</style></head><body><div class="kartu">
<h1>Rara · Sehatku</h1><p class="sub">Tautkan nomor WhatsApp bot</p><div id="isi">Memuat...</div></div>
<script>
const token=new URLSearchParams(location.search).get('token');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function muat(){
  try{
    const s=await (await fetch('/status?token='+encodeURIComponent(token))).json();let h='';
    if(s.keadaan==='terhubung') h='<span class="badge ok">✅ Terhubung</span><p>'+esc(s.info)+'</p><p class="abu">Bot sudah aktif. Halaman ini boleh ditutup.</p>';
    else if(s.keadaan==='memuat') h='<span class="badge tunggu">🔄 Sudah login</span><p>'+esc(s.info)+'</p><p class="abu">Tidak perlu scan lagi. Biarkan HP nomor bot tetap online sampai status menjadi Terhubung.</p>';
    else if(s.keadaan==='terputus') h='<span class="badge putus">⚠️ Terputus</span><p>'+esc(s.info)+'</p>';
    else if(s.kode) h='<span class="badge tunggu">⏳ Menunggu ditautkan</span><h2>Kode tautan</h2><div class="kode">'+esc(s.kode)+'</div>'+
      '<p class="abu" style="text-align:center">untuk nomor +'+esc(s.nomor)+' · diperbarui otomatis ±3 menit</p>'+
      '<ol><li>Buka WhatsApp di HP nomor bot</li><li>Setelan → <b>Perangkat tertaut</b> → <b>Tautkan perangkat</b></li>'+
      '<li>Ketuk <b>Tautkan dengan nomor telepon saja</b></li><li>Masukkan kode di atas</li></ol><button onclick="kodeBaru(this)">Minta kode baru</button>';
    else if(s.qrSvg) h='<span class="badge tunggu">⏳ Menunggu scan</span><h2>Scan QR</h2><div class="qr">'+s.qrSvg+'</div>'+
      '<ol><li>Buka WhatsApp di HP nomor bot</li><li>Setelan → <b>Perangkat tertaut</b> → <b>Tautkan perangkat</b></li><li>Arahkan kamera ke QR ini</li></ol>';
    else h='<span class="badge tunggu">⏳ Menyiapkan WhatsApp...</span><p class="abu">'+esc(s.info||'Tunggu beberapa detik.')+'</p>';
    document.getElementById('isi').innerHTML=h;
  }catch(e){document.getElementById('isi').innerHTML='<span class="badge putus">Bot tidak merespons</span>';}
}
async function kodeBaru(b){b.disabled=true;b.textContent='Meminta...';await fetch('/kode-baru?token='+encodeURIComponent(token),{method:'POST'});setTimeout(muat,3000);}
muat();setInterval(muat,4000);
</script></body></html>`;
}

module.exports = { pasang, opsiClient, normalisasiNomor, formatKode };