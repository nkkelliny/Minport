// renderer.js — whole-window gestures | fist = drag/drop | pinch = zoom
// Requires index.html to include:
// <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"></script>
// <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"></script>

const video  = document.getElementById('cam');
const overlay = document.getElementById('overlay');
const ctx    = overlay.getContext('2d');
const hud    = document.getElementById('hud');
const cursor = document.getElementById('cursor');
const grid   = document.getElementById('grid');

let W = 0, H = 0;
let camera, hands;

let smooth = { x: 400, y: 300 };     // cursor in PAGE space (window coords)
let activeCard = null;                // currently affected widget
let grabState  = false;               // true while fist is closed (drag)
let startDragOffset = { x: 0, y: 0 }; // where inside the card we grabbed (GRID space)
let lastTwoFinger = null;             // previous index–middle distance for zoom deltas

/* ---------------- Canvas sizing: cover the entire window ---------------- */
function fitCanvas() {
  W = overlay.width  = window.innerWidth;
  H = overlay.height = window.innerHeight;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

/* ---------------- Helpers ---------------- */
function getGridRect() { return grid.getBoundingClientRect(); }

function getTransform(card) {
  const m = card.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([\d.]+)\)/);
  if (!m) {
    // Initialize transform from current page position → grid space
    const gridR = getGridRect();
    const r = card.getBoundingClientRect();
    const x = r.left - gridR.left;
    const y = r.top  - gridR.top;
    card.style.position = 'absolute';
    card.style.left = '0';
    card.style.top  = '0';
    card.style.transform = `translate(${x}px, ${y}px) scale(1)`;
    return { x, y, scale: 1 };
  }
  return { x: parseFloat(m[1]), y: parseFloat(m[2]), scale: parseFloat(m[3]) };
}

function setTransform(card, t) {
  card.style.position = 'absolute';
  card.style.left = '0';
  card.style.top  = '0';
  card.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.scale})`;
}

function dist(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return Math.hypot(dx, dy); }
function lerp(a,b,t){ return a+(b-a)*t; }

/* ---------------- Main results handler ---------------- */
function onResults(results) {
  ctx.clearRect(0,0,W,H);
  let gesture = '—';

  if (results.multiHandLandmarks && results.multiHandLandmarks.length) {
    const h0 = results.multiHandLandmarks[0];
    const idx   = h0[8];   // index fingertip
    const thumb = h0[4];   // thumb tip
    const mid   = h0[12];  // middle fingertip

    // Cursor in PAGE space (full window)
    const x = idx.x * W, y = idx.y * H;
    smooth.x = lerp(smooth.x, x, 0.35);
    smooth.y = lerp(smooth.y, y, 0.35);

    // Optional: draw landmarks
    for (const lm of h0) {
      ctx.beginPath();
      ctx.arc(lm.x*W, lm.y*H, 2.5, 0, Math.PI*2);
      ctx.fillStyle = '#ffffff33';
      ctx.fill();
    }

    // --- Gesture classification ---
    // Fist detection: count extended fingers (tips above their lower joints)
    let extended = 0;
    for (const t of [8,12,16,20]) {
      const tip = h0[t], base = h0[t-2];
      if (tip.y < base.y) extended++;
    }
    const isFist = extended <= 1;

    // Pinch detection: index–thumb distance in pixels
    const pinchPx = dist({x:idx.x*W, y:idx.y*H}, {x:thumb.x*W, y:thumb.y*H});
    const isPinching = pinchPx < 40;

    // Cursor in GRID space for transforms
    const gridR = getGridRect();
    const cursorGrid = { x: smooth.x - gridR.left, y: smooth.y - gridR.top };

    // --- Begin drag (fist down) ---
    if (!grabState && isFist) {
      grabState = true;
      cursor.classList.add('grabbing');

      // Pick card under cursor (page-space hit test)
      const cards = [...document.querySelectorAll('.card')].filter(c => c.style.display !== 'none');
      const hit = cards.find(c=>{
        const r = c.getBoundingClientRect();
        return smooth.x >= r.left && smooth.x <= r.right && smooth.y >= r.top && smooth.y <= r.bottom;
      });
      activeCard = hit || activeCard;

      if (activeCard) {
        const t = getTransform(activeCard);
        startDragOffset.x = cursorGrid.x - t.x;
        startDragOffset.y = cursorGrid.y - t.y;
      }
      gesture = 'grab';
    }

    // --- End drag (fist open) ---
    else if (grabState && !isFist) {
      grabState = false;
      activeCard = null;
      cursor.classList.remove('grabbing');
      lastTwoFinger = null; // reset zoom baseline
      gesture = 'release';
    }

    // --- If pinching while over a widget, zoom it (even if not dragging) ---
    if (isPinching) {
      // ensure we have a target: select card under cursor if none
      if (!activeCard) {
        const cards = [...document.querySelectorAll('.card')].filter(c => c.style.display !== 'none');
        const hit = cards.find(c=>{
          const r = c.getBoundingClientRect();
          return smooth.x >= r.left && smooth.x <= r.right && smooth.y >= r.top && smooth.y <= r.bottom;
        });
        activeCard = hit || activeCard;
      }

      if (activeCard) {
        const two = dist({ x: idx.x*W, y: idx.y*H }, { x: mid.x*W, y: mid.y*H });
        if (lastTwoFinger == null) {
          lastTwoFinger = two; // initialize on pinch start
        } else {
          const t = getTransform(activeCard);
          const zoomDelta = two - lastTwoFinger;
          t.scale = Math.max(0.5, Math.min(2.5, t.scale + zoomDelta * 0.0025));
          setTransform(activeCard, t);
          gesture = 'zoom';
          lastTwoFinger = two;
        }
      }
    } else {
      // not pinching → reset baseline so next pinch starts fresh
      lastTwoFinger = null;
    }

    // --- While fist is held, update drag position ---
    if (grabState && activeCard && isFist) {
      const t = getTransform(activeCard);
      t.x = cursorGrid.x - startDragOffset.x;
      t.y = cursorGrid.y - startDragOffset.y;
      setTransform(activeCard, t);
      if (gesture === '—') gesture = 'drag';
    }

    // Update visible cursor (page-space)
    cursor.style.left = `${smooth.x}px`;
    cursor.style.top  = `${smooth.y}px`;
  } else {
    // No hands detected
    lastTwoFinger = null;
  }

  hud.textContent = `hand: ${results.multiHandLandmarks?.length || 0} | gesture: ${gesture}`;
}

/* ---------------- MediaPipe init ---------------- */
async function initCameraAndHands() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 960, height: 540 }});
  video.srcObject = stream;

  hands = new Hands({
    locateFile: (file)=> `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });
  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    selfieMode: true,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
  });
  hands.onResults(onResults);

  camera = new Camera(video, {
    onFrame: async () => {
      fitCanvas();                 // keep overlay synced to window
      await hands.send({ image: video });
    },
    width: 960, height: 540
  });
  camera.start();
}

initCameraAndHands().catch(err => {
  hud.textContent = 'camera error: ' + err.message;
});
