const followLayer = document.getElementById('followLayer');
const followStage = document.getElementById('followStage');
const followVideo = document.getElementById('followVideo');
const followName = document.getElementById('followName');
const followSfx = document.getElementById('followSfx');
const audioUnlockBtn = document.getElementById('audioUnlock');

const DEFAULT_VIDEO = '/media/follow/new-follower.webm';
const DEFAULT_SOUND = '/media/follow/woosh.mp3';

const ALERT_MS = 5000;
const TEXT_DELAY_MS = 1000;
const TEXT_FADE_OUT_MS = 450;
const TEXT_FADE_OUT_START_MS = ALERT_MS - TEXT_FADE_OUT_MS;

let soundUrl = DEFAULT_SOUND;
let alertEndTimer;
let textShowTimer;
let stageFadeTimer;

let audioCtx;
let wooshBuffer;
let audioUnlocked = false;

function clearFollowTimers() {
  clearTimeout(alertEndTimer);
  clearTimeout(textShowTimer);
  clearTimeout(stageFadeTimer);
}

function hideFollow() {
  clearFollowTimers();
  followLayer.classList.add('hidden');
  followStage.classList.remove('stage-out');
  followVideo.pause();
  followName.classList.remove('name-hidden', 'name-visible');
  followName.textContent = '';
}

async function decodeWoosh() {
  if (!soundUrl || wooshBuffer || !audioCtx) return;
  const res = await fetch(soundUrl);
  if (!res.ok) throw new Error('mp3 ' + res.status);
  const ab = await res.arrayBuffer();
  wooshBuffer = await audioCtx.decodeAudioData(ab.slice(0));
}

async function unlockAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  await audioCtx.resume();
  await decodeWoosh();
  try {
    followSfx.volume = 0;
    followSfx.currentTime = 0;
    await followSfx.play();
    followSfx.pause();
    followSfx.currentTime = 0;
    followSfx.volume = 1;
  } catch (_) {
    /* el <audio> puede seguir bloqueado; Web Audio ya suele bastar */
  }
  audioUnlocked = true;
  audioUnlockBtn.classList.add('hidden');
}

async function playFollowSound() {
  if (audioCtx && audioCtx.state === 'suspended') {
    await audioCtx.resume().catch(() => {});
  }

  if (audioCtx && wooshBuffer && audioCtx.state === 'running') {
    try {
      const src = audioCtx.createBufferSource();
      src.buffer = wooshBuffer;
      src.connect(audioCtx.destination);
      src.start(0);
      return;
    } catch (_) {
      /* fallback abajo */
    }
  }

  const tryFresh = () => {
    const a = new Audio(soundUrl);
    a.volume = 1;
    return a.play();
  };
  followSfx.volume = 1;
  followSfx.currentTime = 0;
  await tryFresh().catch(() => followSfx.play());
}

audioUnlockBtn.addEventListener('click', () => {
  unlockAudio().catch(() => {});
});

window.addEventListener(
  'keydown',
  (e) => {
    if (audioUnlocked) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      unlockAudio().catch(() => {});
    }
  },
  true
);

(async function init() {
  let videoPath = DEFAULT_VIDEO;
  soundUrl = followSfx.getAttribute('src') || DEFAULT_SOUND;

  try {
    const r = await fetch('/api/media-config.json');
    if (r.ok) {
      const cfg = await r.json();
      if (cfg.videoPath) videoPath = cfg.videoPath;
      if (cfg.soundPath) soundUrl = cfg.soundPath;
    }
  } catch (_) {
    /* defaults */
  }

  followVideo.src = videoPath;
  followSfx.src = soundUrl;
  followVideo.load();
  followSfx.load();

  const socket = io();

  socket.on('follow', (data) => {
    const name = data.username || 'alguien';

    clearFollowTimers();

    followName.textContent = name;
    followName.classList.remove('name-visible');
    followName.classList.add('name-hidden');

    followStage.classList.remove('stage-out');
    void followStage.offsetWidth;

    followLayer.classList.remove('hidden');

    followVideo.muted = true;
    followVideo.currentTime = 0;
    followVideo.play().catch(() => {});

    void playFollowSound().catch(() => {});

    textShowTimer = setTimeout(() => {
      followName.classList.remove('name-hidden');
      void followName.offsetWidth;
      followName.classList.add('name-visible');
    }, TEXT_DELAY_MS);

    stageFadeTimer = setTimeout(() => {
      followStage.classList.add('stage-out');
    }, TEXT_FADE_OUT_START_MS);

    alertEndTimer = setTimeout(hideFollow, ALERT_MS);
  });
})();
