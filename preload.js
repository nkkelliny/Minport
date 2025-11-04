// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridge', {
  fetchText: (url) => ipcRenderer.invoke('net:fetchText', url),
  aiChat: (payload) => ipcRenderer.invoke('ai:chat', payload),
  getEnvDefaults: () => ipcRenderer.invoke('env:getDefaults')
});
