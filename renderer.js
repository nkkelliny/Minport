// renderer.js — MediaPipe via CDN globals (Hands, Camera). Whole-window gestures.

const video = document.getElementById('cam');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
const hud = document.getElementById('hud');
const cursor = document.getElementById('cursor');
const grid = document.getElementById('grid');

let W = 0, H = 0;
let camera, hands;
let smooth = { x: 400, y: 300 };     // cursor in PAGE coordinates (window)
let activeCard = null;
let grabState = false;
let startDragOffset = { x:0, y:0 };   // in GRID coordinates
let lastTwoFinger = null;

function fitCanvas() {
  // Make overlay truly full-window
  W = overlay.width  = window.innerWidth;
  H = overlay.height = window.innerHeight;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

// Grid rect helper (page-space rect of the grid container)
function getGridRect() {
  return grid.getBoundingClientRect();
}

// Parse current transform of a card (grid-space)
function getTransform(card) {
  const m = card.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([\d.]+)\)/);
  if (!m) {
    // Initialize transform based on current page position converted into grid-space
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

// Apply transform (grid-space)
function setTransform(card, t) {
  card.style.position = 'absolute';
  card.style.left = '0';
  card.style.top  = '0';
  card.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.scale})`;
}

// Math utils
function dist(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return Math.hypot(dx, dy); }
function lerp(a,b,t){ return a+(b-a)*t; }

function onResults(results) {
  ctx.clearRect(0,0,W,H);
  let gesture = '—';

  if (results.multiHandLandmarks && results.multiHandLandmarks.length) {
    const h0 = results.multiHandLandmarks[0];
    const idx = h0[8];   // index fingertip
    const thumb = h0[4]; // thumb tip

    // Hand landmarks are normalized [0..1] in video space — map to overlay (full window)
    const x = idx.x * W;
    const y = idx.y * H;

    // Smooth cursor in PAGE space
    smooth.x = lerp(smooth.x, x, 0.35);
    smooth.y = lerp(smooth.y, y, 0.35);

    // Draw landmarks (optional)
    for (const lm of h0) {
      ctx.beginPath();
      ctx.arc(lm.x*W, lm.y*H, 2.5, 0, Math.PI*2);
      ctx.fillStyle = '#ffffff33';
      ctx.fill();
    }

    // Pinch detection in pixels
    const pinchPx = dist(
      { x: idx.x*W, y: idx.y*H },
      { x: thumb.x*W, y: thumb.y*H }
    );
    const pinchDown = pinchPx < 35;
    const pinchUp   = pinchPx > 50;

    // Convert current cursor PAGE coords to GRID coords for dragging logic
    const gridR = getGridRect();
    const cursorGrid = { x: smooth.x - gridR.left, y: smooth.y - gridR.top };

    if (!grabState && pinchDown) {
      grabState = true;
      cursor.classList.add('grabbing');

      // Find card under cursor (page-space hit test)
      const cards = [...document.querySelectorAll('.card')].filter(c => c.style.display !== 'none');
      const hit = cards.find(c=>{
        const r = c.getBoundingClientRect();
        return smooth.x >= r.left && smooth.x <= r.right && smooth.y >= r.top && smooth.y <= r.bottom;
      });
      activeCard = hit || activeCard;

      if (activeCard) {
        const t = getTransform(activeCard); // grid-space
        // Store where we grabbed the card (grid-space)
        startDragOffset.x = cursorGrid.x - t.x;
        startDragOffset.y = cursorGrid.y - t.y;
      }
      gesture = 'grab';
    } else if (grabState && pinchUp) {
      grabState = false;
      activeCard = null;
      cursor.classList.remove('grabbing');
      gesture = 'release';
    } else {
      gesture = grabState ? 'holding' : 'hover';
    }

    // Two-finger (index-middle) distance for zoom
    let zoomDelta = 0;
    if (results.multiHandLandmarks.length >= 1) {
      const mid = h0[12];
      const two = dist(
        { x: idx.x*W, y: idx.y*H },
        { x: mid.x*W, y: mid.y*H }
      );
      if (lastTwoFinger != null) zoomDelta = two - lastTwoFinger;
      lastTwoFinger = two;
    }

    if (grabState && activeCard) {
      const t = getTransform(activeCard); // grid-space
      // New position = cursor grid coords minus where we grabbed it
      t.x = cursorGrid.x - startDragOffset.x;
      t.y = cursorGrid.y - startDragOffset.y;

      // Zoom while holding
      if (Math.abs(zoomDelta) > 1) {
        t.scale = Math.max(0.5, Math.min(2.5, t.scale + zoomDelta * 0.0025));
        gesture = 'zoom';
      }
      setTransform(activeCard, t);
    }

    // Update visible cursor (page-space)
    cursor.style.left = `${smooth.x}px`;
    cursor.style.top  = `${smooth.y}px`;
  } else {
    lastTwoFinger = null;
  }

  hud.textContent = `hand: ${results.multiHandLandmarks?.length || 0} | gesture: ${gesture}`;
}

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
      fitCanvas();           // keep overlay full-window on any size change
      await hands.send({ image: video });
    },
    width: 960, height: 540
  });
  camera.start();
}

initCameraAndHands().catch(err => {
  hud.textContent = 'camera error: ' + err.message;
});
