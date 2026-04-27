require('dotenv').config();

const fs = require('fs');
const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');

const tiktokUsername = process.env.TIKTOK_USERNAME || 'g1000_0';

const assetsFollowDir = path.resolve(
  process.env.FOLLOW_ASSETS_DIR || path.join(__dirname, 'assets', 'follow')
);
const webmFile = path.basename(process.env.FOLLOW_WEBM_FILE || 'new-follower.webm');
const mp3File = path.basename(process.env.FOLLOW_SOUND_FILE || 'woosh.mp3');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const tiktok = new TikTokLiveConnection(tiktokUsername);

function emitFollow(username) {
  io.emit('follow', { username });
}

tiktok
  .connect()
  .then((state) => {
    console.log('Conectado a TikTok Live', state.roomId ? `roomId=${state.roomId}` : '');
  })
  .catch((err) => {
    console.error('No se pudo conectar (¿estás en vivo con ese @?):', err.message || err);
  });

tiktok.on(WebcastEvent.FOLLOW, (data) => {
  const username = data.user?.uniqueId || data.user?.nickname || 'alguien';
  emitFollow(username);
});

app.use('/media/follow', express.static(assetsFollowDir));

app.get('/api/media-config.json', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    videoPath: `/media/follow/${encodeURIComponent(webmFile)}`,
    soundPath: `/media/follow/${encodeURIComponent(mp3File)}`,
  });
});

function handleTestFollow(req, res) {
  const required = process.env.TEST_FOLLOW_SECRET;
  if (required && req.query.secret !== required) {
    res.status(403).type('text/plain').send('Falta secret válido (TEST_FOLLOW_SECRET en .env).');
    return;
  }
  const raw =
    req.params.username != null && req.params.username !== ''
      ? String(req.params.username)
      : req.query.name != null
        ? String(req.query.name)
        : 'usuario_test';
  const username = raw.replace(/[^\w.-]/g, '').slice(0, 64) || 'usuario_test';
  emitFollow(username);
  console.log('[test-follow]', username);
  res.json({ ok: true, username });
}

app.get('/api/test-follow/:username', handleTestFollow);
app.get('/api/test-follow', handleTestFollow);

app.use(express.static(path.join(__dirname, 'public')));

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, '0.0.0.0', () => {
  const base =
    process.env.RAILWAY_PUBLIC_DOMAIN != null && process.env.RAILWAY_PUBLIC_DOMAIN !== ''
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : `http://localhost:${PORT}`;
  console.log(`Overlay: ${base}/`);
  console.log(`Prueba follow: ${base}/api/test-follow/test_user`);
  console.log(`Usuario TikTok: @${tiktokUsername}`);
  console.log('Carpeta de medios (follow):', assetsFollowDir);
  for (const [label, name] of [
    ['Animación', webmFile],
    ['Sonido', mp3File],
  ]) {
    const full = path.join(assetsFollowDir, name);
    if (!fs.existsSync(full)) {
      console.warn(`[follow] Falta ${label}: ${name} → ${full}`);
    }
  }
});
