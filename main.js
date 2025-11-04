// main.js
const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
require('dotenv').config();

let win;

async function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 860,
    backgroundColor: '#0f1220',
    title: 'Minport',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // Camera permission
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => {
    if (permission === 'media') return cb(true);
    cb(false);
  });

  await win.loadFile('index.html');

  // Open external links in browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

const ENV = {
  OLLAMA_URL: process.env.MINPORT_OLLAMA_URL || '',
  OLLAMA_MODEL: process.env.MINPORT_OLLAMA_MODEL || 'llama3.2',
  OPENAI_KEY: process.env.MINPORT_OPENAI_API_KEY || '',
  LAT: parseFloat(process.env.MINPORT_LAT || '40.7357'),
  LON: parseFloat(process.env.MINPORT_LON || '-74.1724')
};

/* CORS-safe fetch proxy */
ipcMain.handle('net:fetchText', async (_evt, url) => {
  const res = await fetch(url, { headers: { 'User-Agent': 'Minport/1.1' } });
  return await res.text();
});

/* Defaults to renderer */
ipcMain.handle('env:getDefaults', () => ({ lat: ENV.LAT, lon: ENV.LON }));

/* AI chat (Ollama → OpenAI → local) */
ipcMain.handle('ai:chat', async (_evt, { messages, system }) => {
  try {
    if (ENV.OLLAMA_URL) {
      const url = `${ENV.OLLAMA_URL.replace(/\/$/, '')}/api/chat`;
      const body = { model: ENV.OLLAMA_MODEL, messages: [...(system ? [{ role:'system', content:system }] : []), ...messages], stream:false };
      const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
      if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
      const j = await r.json();
      const content = j?.message?.content || '';
      return { provider:'ollama', content };
    }
    if (ENV.OPENAI_KEY) {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST',
        headers:{ 'Authorization':`Bearer ${ENV.OPENAI_KEY}`, 'Content-Type':'application/json' },
        body:JSON.stringify({ model:'gpt-4o-mini', temperature:0.2, messages:[...(system?[{role:'system',content:system}]:[]), ...messages] })
      });
      if (!r.ok) throw new Error(`OpenAI HTTP ${r.status}`);
      const j = await r.json();
      const content = j?.choices?.[0]?.message?.content || '';
      return { provider:'openai', content };
    }
    return { provider:'local', content:'' };
  } catch (e) {
    return { provider:'error', error:e.message || String(e) };
  }
});
