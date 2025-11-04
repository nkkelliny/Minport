// ai.js
import { getWidgetCard, initWidgets } from './widgets.js';

const voiceText = document.getElementById('voiceText');
const aiText = document.getElementById('aiText');
const micBtn = document.getElementById('micBtn');
const resetBtn = document.getElementById('resetBtn');

let recognizing = false;
let rec = null;

function speak(text) {
  try { speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(text), { rate:1.0, pitch:1.0 })); } catch {}
}
function setVoiceText(msg) { voiceText.textContent = `Voice: ${msg}`; }
function setAIText(msg) { aiText.textContent = `AI: ${msg}`; }

function absolutize(card) {
  const grid = document.getElementById('grid');
  const rect = grid.getBoundingClientRect();
  const r = card.getBoundingClientRect();
  card.style.position = 'absolute';
  card.style.left = '0';
  card.style.top = '0';
  card.style.transform = `translate(${r.left - rect.left}px, ${r.top - rect.top}px) scale(1)`;
}

function moveWidget(name, dx, dy) {
  const card = getWidgetCard(name);
  if (!card) return;
  absolutize(card);
  const m = card.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([\d.]+)\)/);
  let x=0,y=0,s=1;
  if (m) { x = parseFloat(m[1]); y = parseFloat(m[2]); s = parseFloat(m[3]); }
  x += dx; y += dy;
  card.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
}

function scaleWidget(name, factor) {
  const card = getWidgetCard(name);
  if (!card) return;
  absolutize(card);
  const m = card.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([\d.]+)\)/);
  let x=0,y=0,s=1;
  if (m) { x = parseFloat(m[1]); y = parseFloat(m[2]); s = parseFloat(m[3]); }
  s = Math.max(0.5, Math.min(2.5, s * factor));
  card.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
}

function openWidget(name) { /* Gallery-based add is handled in widgets.js; leave voice open/close minimal */ }
function closeWidget(name) { const card = getWidgetCard(name); if (card) card.remove(); }

function localIntentRouter(text) {
  const t = text.toLowerCase();
  const pick = () => (t.includes('weather') && 'weather') || (t.includes('news') && 'news') || (t.includes('calendar') && 'calendar') || null;

  if (/(open|show)\b/.test(t)) return { action: 'open_widget', target: pick() };
  if (/(close|hide)\b/.test(t)) return { action: 'close_widget', target: pick() };
  if (/bigger|zoom in|enlarge|increase size/.test(t)) return { action: 'scale_widget', target: pick(), amount: 1.2 };
  if (/smaller|zoom out|shrink|decrease size/.test(t)) return { action: 'scale_widget', target: pick(), amount: 0.85 };
  if (/move.*left/.test(t)) return { action: 'move_widget', target: pick(), dx: -60, dy: 0 };
  if (/move.*right/.test(t)) return { action: 'move_widget', target: pick(), dx: 60, dy: 0 };
  if (/move.*up/.test(t)) return { action: 'move_widget', target: pick(), dx: 0, dy: -60 };
  if (/move.*down/.test(t)) return { action: 'move_widget', target: pick(), dx: 0, dy: 60 };
  if (/reset/.test(t)) return { action: 'reset_layout' };
  if (/temperature|weather|forecast/.test(t)) return { action: 'say_weather' };
  if (/help/.test(t)) return { action: 'help' };
  return { action: 'none' };
}

async function handleNLU(text) {
  const system = `You control Minport (widgets: calendar, weather, news). Output JSON only:
{"action":"open_widget|close_widget|move_widget|scale_widget|say_weather|reset_layout|help|none",
 "target":"weather|news|calendar|null","dx":number|null,"dy":number|null,"amount":number|null,"speech":"short confirmation"}`;
  const messages = [{ role: 'user', content: text }];
  const r = await window.bridge.aiChat({ messages, system });
  if (r?.provider === 'ollama' || r?.provider === 'openai') {
    try {
      const json = JSON.parse(r.content.trim().match(/\{[\s\S]*\}$/)?.[0] || '{}');
      return json;
    } catch {}
  }
  return localIntentRouter(text);
}

async function executeIntent(intent) {
  switch (intent.action) {
    case 'open_widget':
      // For built-in supported names only (calendar/weather/news).
      // (Gallery adding for others is manual.)
      if (intent.speech) speak(intent.speech);
      setAIText(`open ${intent.target || '?'}`);
      break;
    case 'close_widget':
      if (intent.target) closeWidget(intent.target);
      if (intent.speech) speak(intent.speech);
      setAIText(`close ${intent.target || '?'}`);
      break;
    case 'scale_widget':
      if (intent.target) scaleWidget(intent.target, intent.amount || 1.1);
      if (intent.speech) speak(intent.speech);
      setAIText(`scale ${intent.target || '?'} x${intent.amount || 1.1}`);
      break;
    case 'move_widget':
      if (intent.target) moveWidget(intent.target, intent.dx || 0, intent.dy || 0);
      if (intent.speech) speak(intent.speech);
      setAIText(`move ${intent.target || '?'} (${intent.dx||0},${intent.dy||0})`);
      break;
    case 'say_weather':
      {
        const el = document.querySelector('.card[data-id="weather"] .content');
        const text = el ? el.innerText : 'Weather not loaded yet.';
        speak(text.replace(/\s+/g,' ').trim());
        setAIText('speak weather');
      }
      break;
    case 'reset_layout':
      window.location.reload();
      break;
    case 'help':
      {
        const msg = 'Try: "open weather", "make news bigger", "move calendar left", "what’s the temperature", or use the Widget Gallery.';
        speak(msg);
        setAIText('help shown');
      }
      break;
    case 'none':
    default:
      setAIText('no action');
  }
}

function initVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { setVoiceText('Web Speech unavailable'); micBtn.disabled = true; return; }
  const rec = new SR();
  rec.lang = 'en-US'; rec.continuous = true; rec.interimResults = true;

  rec.onstart = () => setVoiceText('listening…');
  rec.onerror = (e) => setVoiceText(`error: ${e.error}`);
  rec.onend = () => { setVoiceText('off'); micBtn.textContent = '🎤'; };
  rec.onresult = async (evt) => {
    let finalText = '';
    for (let i=evt.resultIndex; i<evt.results.length; i++) {
      const t = evt.results[i][0].transcript;
      if (evt.results[i].isFinal) finalText += t;
    }
    if (finalText) {
      setVoiceText(finalText);
      const intent = await handleNLU(finalText);
      await executeIntent(intent);
    }
  };

  let active = false;
  micBtn.addEventListener('click', () => {
    if (!active) { rec.start(); micBtn.textContent = '■'; setVoiceText('starting…'); active = true; }
    else { rec.stop(); micBtn.textContent = '🎤'; setVoiceText('off'); active = false; }
  });
}

resetBtn.addEventListener('click', () => window.location.reload());
window.addEventListener('load', async () => { initVoice(); await initWidgets(); });
