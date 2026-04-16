// ═══════════════════════════════════════════════════════════════
// EMOTION BREW — app.js
// Three.js background · Tab slider · Mood picker · Text/Face ML
// Language filter · Mini player · Link preview · Accessibility
// ═══════════════════════════════════════════════════════════════

// ── THREE.JS WARM PARTICLE BACKGROUND ─────────────────────────
(function initThree() {
  if (typeof THREE === 'undefined') return;

  const canvas   = document.getElementById('bg-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);
  camera.position.z = 30;

  // Helper — make a particle cloud
  function makeCloud(count, color, size, opacity, spread) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) pos[i] = (Math.random() - 0.5) * spread;
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({ color, size, transparent: true, opacity }));
  }

  const dust  = makeCloud(320, 0xC87828, 0.18, 0.28, 100);
  const glow  = makeCloud(130, 0xF0C060, 0.10, 0.16, 120);
  scene.add(dust, glow);

  // Gentle floating rings
  const ringDefs = [
    { r: 13, c: 0xD47E30, x: -17, y:  7, z: -20 },
    { r:  8, c: 0x8D5A2B, x:  15, y: -5, z: -15 },
    { r:  5, c: 0xC87028, x:   3, y: 13, z: -24 },
  ];
  const rings = ringDefs.map(d => {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(d.r, 0.055, 8, 38),
      new THREE.MeshBasicMaterial({ color: d.c, transparent: true, opacity: 0.10 })
    );
    mesh.position.set(d.x, d.y, d.z);
    scene.add(mesh);
    return mesh;
  });

  let mouseX = 0, mouseY = 0, t = 0;
  document.addEventListener('mousemove', e => {
    mouseX = (e.clientX / innerWidth  - 0.5);
    mouseY = (e.clientY / innerHeight - 0.5);
  });

  (function loop() {
    requestAnimationFrame(loop);
    t += 0.003;
    dust.rotation.y  +=  0.00014;
    glow.rotation.y  -= 0.00010;
    rings.forEach((r, i) => {
      r.rotation.x += 0.0015 + i * 0.0008;
      r.rotation.z += 0.0010 + i * 0.0005;
      r.position.y  = ringDefs[i].y + Math.sin(t + i * 1.2) * 2;
    });
    camera.position.x += (mouseX *  2 - camera.position.x) * 0.018;
    camera.position.y += (-mouseY * 1.5 - camera.position.y) * 0.018;
    camera.lookAt(scene.position);
    renderer.render(scene, camera);
  })();

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
})();

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const EMOJI = {
  joy: '😄', sadness: '😢', anger: '😠',
  fear: '😨', surprise: '😲', love: '🥰', neutral: '😐',
};

const DESCS = {
  joy:      'Bright energy & upbeat rhythms',
  sadness:  'Soft melodies for quiet moments',
  anger:    'Intense beats & raw power',
  fear:     'Tense atmospheric soundscapes',
  surprise: 'Unexpected electrifying tracks',
  love:     'Warm tender romantic tones',
  neutral:  'Balanced easy-going vibes',
};

const EMOTION_COLOR = {
  joy: '#D97706', sadness: '#3B82F6', anger: '#DC2626',
  fear: '#7C3AED', surprise: '#EA580C', love: '#DB2777', neutral: '#8D5A2B',
};

const LANG_FLAG = {
  english: '🇬🇧', hindi: '🇮🇳', telugu: '🕌',
  tamil: '🌺', punjabi: '🌾',
};

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════
let curMode    = 'mood';
let curLang    = 'all';
let curEmotion = 'joy';
let camStream  = null;
let lpTimer    = null;
let playlist   = [];
let playIdx    = 0;
let isPlaying  = false;

// ── DOM shortcuts ──────────────────────────────────────────────
const $ = id => document.getElementById(id);
const txtin  = $('txtin');
const cnEl   = $('cn');

// ═══════════════════════════════════════════════════════════════
// TAB SLIDER — smooth animated indicator
// ═══════════════════════════════════════════════════════════════
function updateTabSlider(mode) {
  const slider = $('tab-slider');
  if (!slider) return;
  const btn    = $('tab-' + mode);
  if (!btn) return;
  const nav    = btn.closest('.tabs');
  const navRect = nav.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  slider.style.left   = (btnRect.left - navRect.left - 4) + 'px';
  slider.style.width  = btnRect.width + 'px';
}

// ── Run once on load to position slider correctly
window.addEventListener('load', () => updateTabSlider('mood'));

// ═══════════════════════════════════════════════════════════════
// CHAR COUNTER
// ═══════════════════════════════════════════════════════════════
txtin?.addEventListener('input', () => {
  cnEl.textContent = txtin.value.length;
});
txtin?.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.ctrlKey) analyzeText();
});

// ═══════════════════════════════════════════════════════════════
// MODE SWITCH
// ═══════════════════════════════════════════════════════════════
function switchMode(mode) {
  curMode = mode;

  ['mood', 'text', 'face'].forEach(m => {
    const panel = $('panel-' + m);
    const tab   = $('tab-' + m);
    if (panel) panel.classList.toggle('hidden', m !== mode);
    if (tab) {
      tab.classList.toggle('tab-on', m === mode);
      tab.setAttribute('aria-selected', m === mode ? 'true' : 'false');
    }
  });

  updateTabSlider(mode);
  hideResults();
  hideErr();

  if (mode !== 'face' && camStream) {
    camStream.getTracks().forEach(t => t.stop());
    camStream = null;
    const sc = $('cosc');
    if (sc) sc.classList.remove('on');
  }
}

// ═══════════════════════════════════════════════════════════════
// LANGUAGE FILTER
// ═══════════════════════════════════════════════════════════════
function setLang(btn) {
  document.querySelectorAll('.lpill').forEach(p => p.classList.remove('lpill-on'));
  btn.classList.add('lpill-on');
  curLang = btn.dataset.lang;
  // If results already showing — re-fetch with new language
  if (!$('results').classList.contains('hidden')) {
    fetchAndShow(curEmotion, curLang);
  }
}

// ═══════════════════════════════════════════════════════════════
// MOOD PICKER
// ═══════════════════════════════════════════════════════════════
async function pickMood(tile) {
  document.querySelectorAll('.mc').forEach(c => c.classList.remove('sel'));
  tile.classList.add('sel');

  const emotion = tile.dataset.emotion;
  curEmotion    = emotion;

  // Bounce animation
  const emojiEl = tile.querySelector('.mc-em');
  if (emojiEl) {
    emojiEl.style.transform = 'scale(1.5) rotate(12deg)';
    setTimeout(() => { emojiEl.style.transform = ''; }, 320);
  }

  await fetchAndShow(emotion, curLang, { emotion, confidence: 100, source: 'mood' });
}

// ═══════════════════════════════════════════════════════════════
// TEXT ANALYSIS
// ═══════════════════════════════════════════════════════════════
async function analyzeText() {
  const text = (txtin?.value || '').trim();
  if (!text) {
    showErr('Please write something about how you feel.');
    return;
  }
  showLoad();
  try {
    const res  = await fetch('/predict/text', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error('Server error ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    curEmotion = data.emotion;
    await fetchAndShow(data.emotion, curLang, data);
  } catch (e) {
    hideLoad();
    showErr('Error: ' + e.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// FACE DETECTION
// ═══════════════════════════════════════════════════════════════
async function startCam() {
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    $('webcam').srcObject = camStream;
    const sc = $('cosc');
    if (sc) sc.classList.add('on');
    const st = $('costi');
    if (st) st.textContent = 'Camera ready — look naturally';
    const btn = $('capbtn');
    if (btn) { btn.disabled = false; btn.removeAttribute('aria-disabled'); }
  } catch (e) {
    showErr('Camera access denied — allow camera permission in your browser.');
  }
}

async function captureFace() {
  if (!camStream) { showErr('Camera not started.'); return; }
  const video  = $('webcam');
  const canvas = $('canvas');
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const b64 = canvas.toDataURL('image/jpeg', 0.85);

  showLoad();
  try {
    const res  = await fetch('/predict/face', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ image: b64 }),
    });
    if (!res.ok) throw new Error('Server error ' + res.status);
    const data = await res.json();
    if (data.error && data.confidence === 0) throw new Error(data.error);
    curEmotion = data.emotion;
    await fetchAndShow(data.emotion, curLang, data);
  } catch (e) {
    hideLoad();
    showErr('Error: ' + e.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// FETCH + DISPLAY — shared by all three modes
// ═══════════════════════════════════════════════════════════════
async function fetchAndShow(emotion, language, eData) {
  if (!eData) {
    showLoad();
    eData = { emotion, confidence: 100, source: 'mood' };
  } else {
    showLoad();
  }
  try {
    const res  = await fetch('/recommend', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ emotion, language }),
    });
    if (!res.ok) throw new Error('Server error ' + res.status);
    const data = await res.json();
    playlist   = data.songs || [];
    playIdx    = 0;
    hideLoad();
    renderResults(eData, playlist);
  } catch (e) {
    hideLoad();
    showErr('Could not load recommendations: ' + e.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// RENDER RESULTS
// ═══════════════════════════════════════════════════════════════
function renderResults(eData, songs) {
  const em     = eData.emotion   || 'joy';
  const conf   = eData.confidence || 100;
  const isMood = eData.source === 'mood';
  const isFace = eData.source === 'face';
  const langLabel = curLang === 'all'
    ? 'All Languages'
    : (curLang.charAt(0).toUpperCase() + curLang.slice(1));

  // Emotion card
  $('e-emoji').textContent  = EMOJI[em] || '🎵';
  $('ename').textContent    = em.charAt(0).toUpperCase() + em.slice(1);
  $('edesc').textContent    = DESCS[em] || 'Curated just for you';
  $('ealgo').textContent    = isMood ? 'Direct Pick'  : (isFace ? 'CNN + FER2013' : 'SVM + TF-IDF');
  $('econf').textContent    = conf + '%';
  $('elang').textContent    = langLabel;
  $('ectag1').textContent   = isMood ? 'Mood'   : (isFace ? 'CNN'   : 'SVM');
  $('ectag2').textContent   = isMood ? 'Picker' : (isFace ? 'Face'  : 'Text');

  // Confidence donut — r=36, circumference ≈ 226.2
  const circ   = 226.2;
  const offset = circ * (1 - Math.min(conf, 100) / 100);
  $('cr-pct').textContent = conf + '%';
  setTimeout(() => {
    const fill = $('cr-f');
    if (fill) fill.style.strokeDashoffset = offset;
  }, 80);

  // Emotion theme class
  const results = $('results');
  results.className = 'results t-' + em;

  // Render song cards with staggered animation
  const col = EMOTION_COLOR[em] || '#D47E30';
  $('sgrid').innerHTML = songs.map((s, i) => {
    const vibe = 85 + Math.floor(Math.random() * 14);
    const flag = LANG_FLAG[s.language] || '';
    return `
      <div class="scard"
        data-idx="${i}"
        data-title="${esc(s.song_name)}"
        data-artist="${esc(s.artist)}"
        data-genre="${esc(s.genre)}"
        data-lang="${esc(s.language || '')}"
        data-yt="${esc(s.youtube || '#')}"
        data-vibe="${vibe}"
        data-emotion="${em}"
        role="listitem"
        tabindex="0"
        onclick="playCard(${i})"
        onkeydown="if(event.key==='Enter'||event.key===' ')playCard(${i})"
        onmouseenter="lpShow(event, this)"
        onmouseleave="lpHide()"
        onmousemove="lpMove(event)"
        style="animation-delay:${i * 0.055}s"
        aria-label="Play ${esc(s.song_name)} by ${esc(s.artist)}">
        <div class="sc-band">
          <div class="sc-band-bg" style="background:${col}"></div>
          <span class="sc-num">Track ${String(i + 1).padStart(2, '0')}</span>
          <div class="sc-btn" aria-hidden="true">▶</div>
        </div>
        <div class="sc-body">
          <p class="sc-title">${esc(s.song_name)}</p>
          <p class="sc-artist">${esc(s.artist)}</p>
          <div class="sc-chips">
            <span class="sc-genre">${esc(s.genre)}</span>
            <span class="sc-lang">${flag} ${esc(s.language || '')}</span>
          </div>
        </div>
      </div>`;
  }).join('');

  results.classList.remove('hidden');
  setTimeout(() => {
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

// ═══════════════════════════════════════════════════════════════
// MINI PLAYER
// ═══════════════════════════════════════════════════════════════
function playCard(idx) {
  playIdx   = idx;
  isPlaying = true;
  loadTrack();
  openYouTube();
  setPlayState(true);
}

function loadTrack() {
  const s = playlist[playIdx];
  if (!s) return;
  $('pb-song').textContent   = s.song_name;
  $('pb-artist').textContent = s.artist;
  $('pb-ltag').textContent   = s.language || '—';
  $('pb-yt').href            = s.youtube  || '#';
  $('player-bar').classList.remove('hidden');
}

function setPlayState(playing) {
  isPlaying = playing;
  const vinyl  = $('pb-vinyl');
  const icoP   = document.querySelector('.ico-play');
  const icoPa  = document.querySelector('.ico-pause');
  if (vinyl) vinyl.classList.toggle('spinning', playing);
  if (icoP)  icoP.classList.toggle('hidden',  playing);
  if (icoPa) icoPa.classList.toggle('hidden', !playing);
}

function playerToggle() {
  if (!playlist.length) return;
  if (!isPlaying) {
    openYouTube();
    setPlayState(true);
  } else {
    setPlayState(false);
  }
}

function playerNext() {
  if (!playlist.length) return;
  playIdx = (playIdx + 1) % playlist.length;
  loadTrack();
  if (isPlaying) openYouTube();
}

function playerPrev() {
  if (!playlist.length) return;
  playIdx = (playIdx - 1 + playlist.length) % playlist.length;
  loadTrack();
  if (isPlaying) openYouTube();
}

function openYouTube() {
  const s = playlist[playIdx];
  if (s && s.youtube && s.youtube !== '#') {
    window.open(s.youtube, '_blank', 'noopener,noreferrer');
  }
}

function closePlayer() {
  $('player-bar').classList.add('hidden');
  setPlayState(false);
}

// ═══════════════════════════════════════════════════════════════
// LINK PREVIEW
// ═══════════════════════════════════════════════════════════════
const lpEl = $('lp');

function lpShow(e, card) {
  clearTimeout(lpTimer);

  // Populate
  $('lp-song').textContent  = card.dataset.title;
  $('lp-by').textContent    = card.dataset.artist;
  $('lp-genre').textContent = card.dataset.genre;
  $('lp-lang').textContent  = (LANG_FLAG[card.dataset.lang] || '') + ' ' + card.dataset.lang;

  // Art tint per emotion
  const art = $('lp-art');
  art.className = 'lp-art lp-' + card.dataset.emotion;

  lpPos(e);
  lpEl.classList.remove('hidden');
  requestAnimationFrame(() => lpEl.classList.add('on'));
}

function lpMove(e) {
  lpPos(e);
}

function lpHide() {
  lpEl.classList.remove('on');
  lpTimer = setTimeout(() => lpEl.classList.add('hidden'), 220);
}

function lpPos(e) {
  const W = 256, H = 230, P = 12;
  let l = e.clientX + 16;
  let t = e.clientY - H / 2;
  if (l + W > innerWidth  - P) l = e.clientX - W - 16;
  if (t < P)                   t = P;
  if (t + H > innerHeight - P) t = innerHeight - H - P;
  lpEl.style.left = l + 'px';
  lpEl.style.top  = t + 'px';
}

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════
function esc(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

function showLoad() {
  $('loading').classList.remove('hidden');
  hideResults();
  hideErr();
}

function hideLoad() {
  $('loading').classList.add('hidden');
}

function hideResults() {
  $('results').classList.add('hidden');
}

function showErr(msg) {
  const el = $('errmsg');
  el.textContent = '⚠ ' + msg;
  el.classList.remove('hidden');
  // Auto-dismiss after 6s
  setTimeout(() => el.classList.add('hidden'), 6000);
}

function hideErr() {
  $('errmsg').classList.add('hidden');
}

function resetApp() {
  hideResults();
  hideErr();
  closePlayer();
  if (txtin) { txtin.value = ''; cnEl.textContent = '0'; }
  document.querySelectorAll('.mc').forEach(c => c.classList.remove('sel'));
  curEmotion = 'joy';
  playlist   = [];
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Expose globals used by inline onclick handlers
window.switchMode  = switchMode;
window.setLang     = setLang;
window.pickMood    = pickMood;
window.analyzeText = analyzeText;
window.startCam    = startCam;
window.captureFace = captureFace;
window.playCard    = playCard;
window.playerToggle= playerToggle;
window.playerNext  = playerNext;
window.playerPrev  = playerPrev;
window.closePlayer = closePlayer;
window.resetApp    = resetApp;
window.lpShow      = lpShow;
window.lpHide      = lpHide;
window.lpMove      = lpMove;