// widgets.js
const grid = document.getElementById('grid');
const gallery = document.getElementById('gallery');
const galleryBtn = document.getElementById('galleryBtn');
const galleryClose = document.getElementById('galleryClose');
const galleryScrim = document.getElementById('galleryScrim');
const galleryList = document.getElementById('galleryList');
const addUrlBtn = document.getElementById('addUrlBtn');
const urlTitle = document.getElementById('urlTitle');
const urlInput = document.getElementById('urlInput');

const weatherElId = 'weather';
const newsElId = 'news';
const calendarElId = 'calendar';

/* ------------------ Persistence ------------------ */
const SAVE_KEY = 'minport.layout.v2';

function loadState() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'); }
  catch { return {}; }
}
function saveState(state) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

let state = loadState();
/* state schema:
{
  widgets: {
    [id]: {
      id, title, type, visible, x, y, scale, payload? (url for iframe)
    }
  },
  order: [ids...]
}
*/

if (!state.widgets) {
  state.widgets = {};
  state.order = [];
}

/* ------------------ Built-in Widget Registry ------------------ */
const Registry = {
  // Core
  calendar: { id:'calendar', title:'Calendar', type:'builtin', desc:'Month view', factory: buildCalendar },
  weather:  { id:'weather',  title:'Weather',  type:'builtin', desc:'Current temperature', factory: buildWeather },
  news:     { id:'news',     title:'Yahoo News', type:'builtin', desc:'Top headlines (RSS)', factory: buildNews },

  // Web embeds (iframe)
  youtube:  { id:'youtube',  title:'YouTube',  type:'iframe',  desc:'YouTube embed/search', url:'https://www.youtube.com/embed?listType=search&list=tech%20news' },
  facebook: { id:'facebook', title:'Facebook', type:'iframe',  desc:'May be blocked by site', url:'https://m.facebook.com' },
  twitter:  { id:'twitter',  title:'Twitter',  type:'iframe',  desc:'May be blocked by site', url:'https://mobile.twitter.com' },
  linkedin: { id:'linkedin', title:'LinkedIn', type:'iframe',  desc:'May be blocked by site', url:'https://www.linkedin.com' },
  google:   { id:'google',   title:'Google Search', type:'iframe', desc:'Search Google', url:'https://www.google.com/webhp?igu=1' },
  robinhood:{ id:'robinhood',title:'Robinhood',type:'iframe',  desc:'May be blocked by site', url:'https://robinhood.com' },

  // Game
  bricks:   { id:'bricks',   title:'Brick Game', type:'builtin', desc:'Simple brick breaker', factory: buildBricks }
};

/* ------------------ Public API used by other modules ------------------ */
export function getWidgetCard(id) {
  return document.querySelector(`.card[data-id="${id}"]`);
}
export async function initWidgets() {
  // Seed defaults if first run
  if (state.order.length === 0) {
    addWidgetById('calendar', { x: 20,  y: 80 });
    addWidgetById('weather',  { x: 380, y: 80 });
    addWidgetById('news',     { x: 740, y: 80, scale: 1 });
  }
  // Render any stored widgets
  for (const id of state.order) {
    const w = state.widgets[id];
    if (w.visible) renderWidget(w);
  }
  renderGallery();
}

/* ------------------ Add/Remove/Toggle ------------------ */
function addWidgetById(id, opts={}) {
  const reg = Registry[id];
  if (!reg) return;
  const w = state.widgets[id] || {
    id: reg.id, title: reg.title, type: reg.type,
    visible: true, x: 40, y: 80, scale: 1, payload: null
  };
  w.visible = true;
  if (opts.x != null) w.x = opts.x;
  if (opts.y != null) w.y = opts.y;
  if (opts.scale != null) w.scale = opts.scale;
  if (reg.url) w.payload = reg.url;
  state.widgets[id] = w;
  if (!state.order.includes(id)) state.order.push(id);
  saveState(state);
  renderWidget(w);
  renderGallery();
}

function addCustomUrlWidget(title, url) {
  const id = `url_${Date.now()}`;
  const w = {
    id, title: title || url, type: 'iframe',
    visible: true, x: 20, y: 380, scale: 1, payload: url
  };
  state.widgets[id] = w;
  state.order.push(id);
  saveState(state);
  renderWidget(w);
  renderGallery();
}

function removeWidget(id) {
  const w = state.widgets[id];
  if (!w) return;
  w.visible = false; // NOT deleted, just hidden to gallery
  saveState(state);
  const el = getWidgetCard(id);
  if (el) el.remove();
  renderGallery();
}

/* ------------------ Rendering Cards ------------------ */
function renderWidget(w) {
  // If already exists, remove & re-add to ensure header events refresh
  const prev = getWidgetCard(w.id);
  if (prev) prev.remove();

  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = w.id;
  card.style.transform = `translate(${w.x}px, ${w.y}px) scale(${w.scale || 1})`;

  const header = document.createElement('header');
  const left = document.createElement('div'); left.innerHTML = `<strong>${w.title}</strong>`;
  const right = document.createElement('div'); right.className = 'toolbar';

  const btnRemove = document.createElement('button');
  btnRemove.textContent = 'Remove';
  btnRemove.title = 'Hide and move to gallery';
  btnRemove.onclick = () => removeWidget(w.id);

  const btnOpen = document.createElement('button');
  btnOpen.textContent = 'Open in Browser';
  btnOpen.style.display = (w.type === 'iframe') ? '' : 'none';
  btnOpen.onclick = () => window.open(w.payload, '_blank');

  right.append(btnRemove, btnOpen);
  header.append(left, right);
  card.append(header);

  const content = document.createElement('div');
  content.className = 'content';
  card.append(content);

  // Build body by type
  if (w.type === 'builtin') {
    const reg = Registry[w.id];
    if (reg?.factory) {
      reg.factory(content);
    } else {
      content.textContent = 'Unknown built-in widget.';
    }
  } else if (w.type === 'iframe') {
    buildIframe(content, w.payload);
  }

  grid.append(card);

  // Observe position/scale changes from drag/zoom (renderer.js updates inline transform)
  // We’ll periodically snapshot transforms to persist
  snapshotLoopStart();
}

function renderGallery() {
  galleryList.innerHTML = '';

  // Built-ins first (including ones already on desktop)
  for (const key of Object.keys(Registry)) {
    const reg = Registry[key];
    const w = state.widgets[reg.id];
    const visible = w?.visible;

    const row = document.createElement('div');
    row.className = 'widget-row';

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `<span class="title">${reg.title}</span><span class="desc">${reg.desc || ''}</span>`;

    const btn = document.createElement('button');
    btn.textContent = visible ? 'On Desktop' : 'Add';
    btn.disabled = !!visible;
    btn.onclick = () => addWidgetById(reg.id);

    row.append(meta, btn);
    galleryList.append(row);
  }

  // Custom URL widgets (hidden ones)
  const customHidden = Object.values(state.widgets).filter(w => w.type === 'iframe' && w.id.startsWith('url_') && !w.visible);
  if (customHidden.length) {
    const hr = document.createElement('div'); hr.style.margin = '8px 0'; hr.style.borderTop = '1px solid #ffffff18'; hr.style.opacity = '.6';
    galleryList.append(hr);
    for (const w of customHidden) {
      const row = document.createElement('div');
      row.className = 'widget-row';
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.innerHTML = `<span class="title">${w.title}</span><span class="desc">${w.payload}</span>`;
      const btn = document.createElement('button');
      btn.textContent = 'Add';
      btn.onclick = () => { w.visible = true; saveState(state); renderWidget(w); renderGallery(); };
      row.append(meta, btn);
      galleryList.append(row);
    }
  }
}

/* ------------------ Widget Factories ------------------ */
function buildCalendar(container) {
  const now = new Date();
  const month = now.toLocaleString([], { month:'long', year:'numeric' });
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth()+1, 0);

  let html = `<div style="font-weight:600">${month}</div>
  <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:8px;font-size:12px;">
  <div style="opacity:.6">Sun</div><div style="opacity:.6">Mon</div><div style="opacity:.6">Tue</div><div style="opacity:.6">Wed</div><div style="opacity:.6">Thu</div><div style="opacity:.6">Fri</div><div style="opacity:.6">Sat</div>`;
  const pad = (first.getDay()+7-0)%7;
  for (let i=0;i<pad;i++) html += `<div></div>`;
  for (let d=1; d<=last.getDate(); d++) {
    const isToday = d === now.getDate();
    html += `<div style="padding:6px;border:1px solid #ffffff14;border-radius:8px;text-align:center;${isToday?'background:#5aa8ff22;':''}">${d}</div>`;
  }
  html += `</div>`;
  container.innerHTML = html;
}

async function buildWeather(container) {
  try {
    const { lat, lon } = await window.bridge.getEnvDefaults();
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`;
    const txt = await window.bridge.fetchText(url);
    const data = JSON.parse(txt);
    const c = data.current;
    container.innerHTML = `
      <div><strong>${Math.round(c.temperature_2m)}°C</strong> &nbsp; code ${c.weather_code}</div>
      <div style="opacity:.7;font-size:12px;margin-top:4px">Lat ${lat.toFixed(3)}, Lon ${lon.toFixed(3)}</div>`;
  } catch {
    container.textContent = 'Weather failed to load.';
  }
}

async function buildNews(container) {
  try {
    const rss = await window.bridge.fetchText('https://news.yahoo.com/rss/');
    const items = [...rss.matchAll(/<item>[\s\S]*?<\/item>/g)]
      .slice(0, 6)
      .map(m => {
        const tMatch = m[0].match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
        const t = tMatch ? (tMatch[1] || tMatch[2]) : 'Story';
        const l = (m[0].match(/<link>(.*?)<\/link>/) || [,''])[1];
        return { title: t, link: l };
      });
    container.innerHTML = items.map(i => `<div style="margin:6px 0;">
      <a href="${i.link}" style="color:#9bd" target="_blank" rel="noreferrer">${i.title}</a>
    </div>`).join('');
  } catch {
    container.textContent = 'News failed to load.';
  }
}

function buildIframe(container, url) {
  container.innerHTML = '';
  const frame = document.createElement('iframe');
  frame.src = url;
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups'); // safer
  frame.style.width = '100%';
  frame.style.height = '360px';
  frame.style.border = '1px solid #ffffff18';
  frame.style.borderRadius = '10px';

  const fallback = document.createElement('div');
  fallback.style.display = 'none';
  fallback.style.fontSize = '13px';
  fallback.style.color = '#9aa4b2';
  fallback.style.marginTop = '6px';
  fallback.innerHTML = `This site may block embedding. <a href="${url}" target="_blank" rel="noreferrer" style="color:#9bd">Open in Browser</a>`;

  frame.addEventListener('load', () => {
    // If blocked, some browsers fire load but with about:blank or empty doc
    try {
      const blocked = !frame.contentWindow || !frame.contentDocument || frame.contentDocument.body.childElementCount === 0;
      fallback.style.display = blocked ? '' : 'none';
    } catch {
      // cross-origin access -> assume okay; if CSP blocked, often you’ll see a blank page; show fallback after short delay
      setTimeout(()=>{ fallback.style.display = ''; }, 300);
    }
  });
  container.append(frame, fallback);
}

/* -------- Brick Breaker simple game -------- */
function buildBricks(container) {
  container.innerHTML = `
    <canvas id="brickCanvas" width="420" height="320" style="width:100%;max-width:100%;border:1px solid #ffffff18;border-radius:10px;"></canvas>
    <div style="font-size:12px;color:#9aa4b2;margin-top:6px">Move mouse to control paddle. Break all bricks!</div>
  `;
  const c = container.querySelector('#brickCanvas');
  const ctx = c.getContext('2d');

  let w = c.width, h = c.height;
  let x = w/2, y = h-30, dx = 2, dy = -2, r = 6;
  let paddleH = 10, paddleW = 72, paddleX = (w-paddleW)/2;
  let right=false, left=false;
  const rows=4, cols=7, pad=8, bw= (w - (cols+1)*pad)/cols, bh=18;
  const bricks = [];
  for (let r=0;r<rows;r++){
    bricks[r]=[];
    for (let c2=0;c2<cols;c2++){ bricks[r][c2]={ x:0,y:0,status:1 }; }
  }

  c.addEventListener('mousemove', (e)=>{
    const rect = c.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    paddleX = Math.max(0, Math.min(w-paddleW, mx - paddleW/2));
  });

  function drawBall(){ ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle="#cfe2ff"; ctx.fill(); ctx.closePath(); }
  function drawPaddle(){ ctx.fillStyle="#5aa8ff"; ctx.fillRect(paddleX, h-paddleH-6, paddleW, paddleH); }
  function drawBricks(){
    for(let r=0;r<rows;r++){
      for(let c2=0;c2<cols;c2++){
        if(!bricks[r][c2].status) continue;
        const bx = pad + c2*(bw+pad);
        const by = pad + r*(bh+pad) + 10;
        bricks[r][c2].x=bx; bricks[r][c2].y=by;
        ctx.fillStyle = "#284b8a";
        ctx.fillRect(bx,by,bw,bh);
      }
    }
  }
  function collision(){
    for(let r=0;r<rows;r++){
      for(let c2=0;c2<cols;c2++){
        const b = bricks[r][c2];
        if(!b.status) continue;
        if(x> b.x && x< b.x+bw && y> b.y && y< b.y+bh){
          dy = -dy;
          b.status=0;
        }
      }
    }
  }
  function allGone(){ return bricks.every(row=>row.every(b=>b.status===0)); }

  function draw(){
    ctx.clearRect(0,0,w,h);
    drawBricks(); drawBall(); drawPaddle(); collision();

    if(x + dx > w-r || x + dx < r) dx = -dx;
    if(y + dy < r) dy = -dy;
    else if(y + dy > h - r - (paddleH+6)) {
      if(x > paddleX && x < paddleX + paddleW) { dy = -dy; }
      else { // reset
        x = w/2; y = h-30; dx = 2; dy = -2;
      }
    }

    x += dx; y += dy;

    if (allGone()){
      ctx.fillStyle="#9ee493";
      ctx.font="20px system-ui";
      ctx.fillText("You win!", w/2 - 40, h/2);
      return; // stop loop
    }
    requestAnimationFrame(draw);
  }
  draw();
}

/* ------------------ Gallery open/close + URL add ------------------ */
function openGallery(){ gallery.classList.add('open'); galleryScrim.classList.add('show'); }
function closeGallery(){ gallery.classList.remove('open'); galleryScrim.classList.remove('show'); }

galleryBtn.addEventListener('click', openGallery);
galleryClose.addEventListener('click', closeGallery);
galleryScrim.addEventListener('click', closeGallery);

addUrlBtn.addEventListener('click', () => {
  const title = (urlTitle.value || '').trim();
  const url = (urlInput.value || '').trim();
  if (!url) return;
  addCustomUrlWidget(title, url);
  urlTitle.value = ''; urlInput.value = '';
  closeGallery();
});

/* ------------------ Transform Snapshot (persist drag/zoom) -------- */
let snapshotTimer = null;
function snapshotLoopStart(){
  if (snapshotTimer) return;
  snapshotTimer = setInterval(() => {
    const cards = [...document.querySelectorAll('.card')];
    for (const card of cards) {
      const id = card.dataset.id;
      const w = state.widgets[id];
      if (!w) continue;
      const m = card.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([\d.]+)\)/);
      if (m) {
        w.x = parseFloat(m[1]);
        w.y = parseFloat(m[2]);
        w.scale = parseFloat(m[3]);
      }
    }
    saveState(state);
  }, 600);
}

export { addWidgetById }; // optional external use
