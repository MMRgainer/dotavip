const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Tell main process whether mouse should pass through
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
  // Windows autostart (login item) — used by the gear settings window
  getAutostart: () => ipcRenderer.invoke('get-autostart'),
  setAutostart: (enabled) => ipcRenderer.invoke('set-autostart', enabled),
  // Auto-updater — used by the gear settings window
  getUpdateReady: () => ipcRenderer.invoke('get-update-ready'),
  installUpdateNow: () => ipcRenderer.invoke('install-update-now'),
});
