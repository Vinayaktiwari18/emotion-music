// ── THREE.JS WARM BACKGROUND ──────────────────────────────────
(function(){
  if(typeof THREE==='undefined') return;
  const cv=document.getElementById('bg-canvas');
  const R=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true});
  R.setPixelRatio(Math.min(devicePixelRatio,1.5));
  R.setSize(innerWidth,innerHeight);
  const S=new THREE.Scene(),C=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.1,200);
  C.position.z=30;
  const mk=(n,c,sz,op,sp)=>{
    const g=new THREE.BufferGeometry(),p=new Float32Array(n*3);
    for(let i=0;i<n*3;i++)p[i]=(Math.random()-.5)*sp;
    g.setAttribute('position',new THREE.BufferAttribute(p,3));
    return new THREE.Points(g,new THREE.PointsMaterial({color:c,size:sz,transparent:true,opacity:op}));
  };
  S.add(mk(300,0xC87828,.18,.28,100));
  S.add(mk(120,0xF0C060,.1,.16,120));
  const rd=[{r:13,c:0xD47E30,x:-17,y:7,z:-20},{r:8,c:0x8D5A2B,x:15,y:-5,z:-15},{r:5,c:0xC87028,x:3,y:13,z:-24}];
  const rings=rd.map(d=>{
    const m=new THREE.Mesh(new THREE.TorusGeometry(d.r,.055,8,38),new THREE.MeshBasicMaterial({color:d.c,transparent:true,opacity:.1}));
    m.position.set(d.x,d.y,d.z);S.add(m);return m;
  });
  let mx=0,my=0,t=0;
  document.addEventListener('mousemove',e=>{mx=(e.clientX/innerWidth-.5);my=(e.clientY/innerHeight-.5)});
  (function loop(){
    requestAnimationFrame(loop);t+=.003;
    S.children[0].rotation.y+=.00014;S.children[1].rotation.y-=.0001;
    rings.forEach((r,i)=>{r.rotation.x+=.0015+i*.0008;r.rotation.z+=.001+i*.0005;r.position.y=rd[i].y+Math.sin(t+i*1.2)*2});
    C.position.x+=(mx*2-C.position.x)*.018;C.position.y+=(-my*1.5-C.position.y)*.018;
    C.lookAt(S.position);R.render(S,C);
  })();
  window.addEventListener('resize',()=>{C.aspect=innerWidth/innerHeight;C.updateProjectionMatrix();R.setSize(innerWidth,innerHeight)});
})();

// ── CONSTANTS ─────────────────────────────────────────────────
const EMOJI={joy:'😄',sadness:'😢',anger:'😠',fear:'😨',surprise:'😲',love:'🥰',neutral:'😐'};
const DESCS={joy:'Bright energy & upbeat rhythms',sadness:'Soft melodies for quiet moments',anger:'Intense beats & raw power',fear:'Tense atmospheric soundscapes',surprise:'Unexpected electrifying tracks',love:'Warm tender romantic tones',neutral:'Balanced easy-going vibes'};
const EMOTION_COLORS={joy:'#D97706',sadness:'#3B82F6',anger:'#DC2626',fear:'#7C3AED',surprise:'#EA580C',love:'#DB2777',neutral:'#8D5A2B'};

// ── STATE ──────────────────────────────────────────────────────
let curMode='mood', camStream=null, lpTimer=null;
let curLang='all', curEmotion='joy';
let playlist=[], playIdx=0, isPlaying=false;

// ── CHAR COUNTER ───────────────────────────────────────────────
const txtel=document.getElementById('txtin');
const cnumel=document.getElementById('cn');
txtel?.addEventListener('input',()=>{cnumel.textContent=txtel.value.length});
txtel?.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.ctrlKey)analyzeText()});

// ── LANGUAGE FILTER ────────────────────────────────────────────
function setLang(btn){
  document.querySelectorAll('.langpill').forEach(p=>p.classList.remove('on'));
  btn.classList.add('on');
  curLang=btn.dataset.lang;
  // Re-fetch if results are visible
  if(!document.getElementById('results').classList.contains('hidden')){
    fetchAndShow(curEmotion,curLang);
  }
}

// ── MODE SWITCH ────────────────────────────────────────────────
function switchMode(m){
  curMode=m;
  ['mood','text','face'].forEach(x=>{
    document.getElementById('panel-'+x).classList.toggle('hidden',x!==m);
    document.getElementById('tab-'+x).classList.toggle('tab-on',x===m);
  });
  hideResults();hideErr();
  if(m!=='face'&&camStream){camStream.getTracks().forEach(t=>t.stop());camStream=null;document.getElementById('cscan').classList.remove('on')}
}

// ── MOOD PICKER ────────────────────────────────────────────────
async function pickMood(tile){
  document.querySelectorAll('.mtile').forEach(t=>t.classList.remove('sel'));
  tile.classList.add('sel');
  const em=tile.dataset.emotion;
  const moji=tile.querySelector('.moji');
  moji.style.transform='scale(1.5) rotate(12deg)';
  setTimeout(()=>moji.style.transform='',300);
  curEmotion=em;
  await fetchAndShow(em,curLang,{emotion:em,confidence:100,source:'mood'});
}

// ── TEXT ANALYSIS ──────────────────────────────────────────────
async function analyzeText(){
  const txt=(txtel?.value||'').trim();
  if(!txt){showErr('Please write something about how you feel.');return}
  showLoad();
  try{
    const r=await fetch('/predict/text',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:txt})});
    const d=await r.json();
    if(d.error)throw new Error(d.error);
    curEmotion=d.emotion;
    await fetchAndShow(d.emotion,curLang,d);
  }catch(e){hideLoad();showErr('Error: '+e.message)}
}

// ── FACE ───────────────────────────────────────────────────────
async function startCam(){
  try{
    camStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}});
    document.getElementById('webcam').srcObject=camStream;
    document.getElementById('cscan').classList.add('on');
    document.getElementById('clbl').textContent='Camera ready — look naturally';
    document.getElementById('capbtn').disabled=false;
  }catch{showErr('Camera access denied — allow camera permission.')}
}
async function captureFace(){
  if(!camStream){showErr('Camera not started.');return}
  const v=document.getElementById('webcam'),cv=document.getElementById('canvas');
  cv.width=v.videoWidth;cv.height=v.videoHeight;cv.getContext('2d').drawImage(v,0,0);
  showLoad();
  try{
    const r=await fetch('/predict/face',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:cv.toDataURL('image/jpeg',.85)})});
    const d=await r.json();
    if(d.error&&d.confidence===0)throw new Error(d.error);
    curEmotion=d.emotion;
    await fetchAndShow(d.emotion,curLang,d);
  }catch(e){hideLoad();showErr('Error: '+e.message)}
}

// ── FETCH + SHOW ───────────────────────────────────────────────
async function fetchAndShow(emotion,language,eData){
  if(!eData){showLoad();eData={emotion,confidence:100,source:'mood'}}
  try{
    const r=await fetch('/recommend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({emotion,language})});
    const d=await r.json();
    hideLoad();
    playlist=d.songs;playIdx=0;
    renderResults(eData,d.songs);
  }catch(e){hideLoad();showErr('Could not load recommendations: '+e.message)}
}

// ── RENDER RESULTS ─────────────────────────────────────────────
function renderResults(eData,songs){
  const em=eData.emotion||'joy';
  const conf=eData.confidence||100;
  const isMood=eData.source==='mood',isFace=eData.source==='face';
  const langLabel=curLang==='all'?'All Languages':curLang.charAt(0).toUpperCase()+curLang.slice(1);

  document.getElementById('e-emoji').textContent=EMOJI[em]||'🎵';
  document.getElementById('ename').textContent=em.charAt(0).toUpperCase()+em.slice(1);
  document.getElementById('edesc').textContent=DESCS[em]||'Curated just for you';
  document.getElementById('ealgo').textContent=isMood?'Direct Pick':(isFace?'CNN + FER2013':'SVM + TF-IDF');
  document.getElementById('econf').textContent=conf+'%';
  document.getElementById('elang').textContent=langLabel;
  document.getElementById('etag1').textContent=isMood?'Mood':(isFace?'CNN':'SVM');
  document.getElementById('etag2').textContent=isMood?'Picker':(isFace?'Face':'Text');

  const circ=201.1,offset=circ*(1-conf/100);
  document.getElementById('dpct').textContent=conf+'%';
  setTimeout(()=>{document.getElementById('dfill').style.strokeDashoffset=offset},80);

  const res=document.getElementById('results');
  res.className='results t-'+em;

  const col=EMOTION_COLORS[em]||'#D47E30';
  document.getElementById('sgrid').innerHTML=songs.map((s,i)=>{
    const vibe=85+Math.floor(Math.random()*14);
    const langFlag={english:'🇬🇧',hindi:'🇮🇳',telugu:'🕌',tamil:'🌺',punjabi:'🌾'}[s.language]||'🎵';
    return `<div class="scard"
      data-idx="${i}" data-title="${esc(s.song_name)}" data-artist="${esc(s.artist)}"
      data-genre="${esc(s.genre)}" data-lang="${esc(s.language||'')}"
      data-yt="${esc(s.youtube||'#')}" data-vibe="${vibe}" data-emotion="${em}"
      onclick="playCard(${i})"
      onmouseenter="lpShow(event,this)" onmouseleave="lpHide()" onmousemove="lpMove(event)">
      <div class="sc-top">
        <div class="sc-top-bg" style="background:${col}"></div>
        <span class="sc-num">Track ${String(i+1).padStart(2,'0')}</span>
        <div class="sc-play-btn">▶</div>
      </div>
      <div class="sc-body">
        <div class="sc-title">${esc(s.song_name)}</div>
        <div class="sc-artist">${esc(s.artist)}</div>
        <div class="sc-badges">
          <span class="sc-genre">${esc(s.genre)}</span>
          <span class="sc-lang">${langFlag} ${esc(s.language||'')}</span>
        </div>
      </div>
    </div>`;
  }).join('');

  // Staggered card animation
  document.querySelectorAll('.scard').forEach((c,i)=>{c.style.animationDelay=(i*.06)+'s'});

  res.classList.remove('hidden');
  setTimeout(()=>res.scrollIntoView({behavior:'smooth',block:'start'}),100);
}

// ── MINI PLAYER ────────────────────────────────────────────────
function playCard(idx){
  playIdx=idx;
  loadPlayer();
  isPlaying=true;
  document.getElementById('pb-playbtn').textContent='⏸';
  document.getElementById('pb-vinyl').classList.add('spinning');
}

function loadPlayer(){
  const s=playlist[playIdx];
  if(!s)return;
  document.getElementById('pb-song').textContent=s.song_name;
  document.getElementById('pb-artist').textContent=s.artist;
  document.getElementById('pb-lang-badge').textContent=s.language||'—';
  document.getElementById('pb-yt').href=s.youtube||'#';
  const pbar=document.getElementById('player-bar');
  pbar.classList.remove('hidden');
}

function playerToggle(){
  isPlaying=!isPlaying;
  document.getElementById('pb-playbtn').textContent=isPlaying?'⏸':'▶';
  document.getElementById('pb-vinyl').classList.toggle('spinning',isPlaying);
  if(isPlaying){
    // Open YouTube in new tab
    const s=playlist[playIdx];
    if(s&&s.youtube)window.open(s.youtube,'_blank','noopener');
  }
}

function playerNext(){
  if(!playlist.length)return;
  playIdx=(playIdx+1)%playlist.length;
  loadPlayer();
  if(isPlaying)window.open(playlist[playIdx].youtube||'#','_blank','noopener');
}

function playerPrev(){
  if(!playlist.length)return;
  playIdx=(playIdx-1+playlist.length)%playlist.length;
  loadPlayer();
  if(isPlaying)window.open(playlist[playIdx].youtube||'#','_blank','noopener');
}

function closePlayer(){
  document.getElementById('player-bar').classList.add('hidden');
  isPlaying=false;
  document.getElementById('pb-vinyl').classList.remove('spinning');
}

// ── LINK PREVIEW ───────────────────────────────────────────────
const lp=document.getElementById('lp');
function lpShow(e,card){
  clearTimeout(lpTimer);
  document.getElementById('lp-sn').textContent=card.dataset.title;
  document.getElementById('lp-sa').textContent=card.dataset.artist;
  document.getElementById('lp-genre').textContent=card.dataset.genre;
  document.getElementById('lp-lang').textContent=card.dataset.lang;
  document.getElementById('lp-art').className='lp-art lp-art-'+card.dataset.emotion;
  lpPos(e);
  lp.classList.remove('hidden');
  requestAnimationFrame(()=>lp.classList.add('on'));
}
function lpMove(e){lpPos(e)}
function lpHide(){lp.classList.remove('on');lpTimer=setTimeout(()=>lp.classList.add('hidden'),230)}
function lpPos(e){
  const W=258,H=220,P=12;
  let l=e.clientX+15,t=e.clientY-H/2;
  if(l+W>innerWidth-P)l=e.clientX-W-15;
  if(t<P)t=P;
  if(t+H>innerHeight-P)t=innerHeight-H-P;
  lp.style.left=l+'px';lp.style.top=t+'px';
}

// ── UTILS ──────────────────────────────────────────────────────
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function showLoad(){document.getElementById('loading').classList.remove('hidden');hideResults();hideErr()}
function hideLoad(){document.getElementById('loading').classList.add('hidden')}
function hideResults(){document.getElementById('results').classList.add('hidden')}
function showErr(msg){const el=document.getElementById('errmsg');el.textContent='⚠ '+msg;el.classList.remove('hidden')}
function hideErr(){document.getElementById('errmsg').classList.add('hidden')}
function resetApp(){
  hideResults();hideErr();closePlayer();
  if(txtel){txtel.value='';cnumel.textContent='0'}
  document.querySelectorAll('.mtile').forEach(t=>t.classList.remove('sel'));
  window.scrollTo({top:0,behavior:'smooth'});
}