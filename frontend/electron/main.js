const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development';

let overlayWindow = null;

function createOverlayWindow() {
  // Find the monitor where Dota 2 would be
  // For now: use the primary display (user can configure)
  const displays = screen.getAllDisplays();
  const targetDisplay = displays[0]; // Primary monitor (Dota monitor)
  const { x, y, width, height } = targetDisplay.bounds;

  overlayWindow = new BrowserWindow({
    x,
    y,
    width,
    height,

    // Overlay settings
    transparent:    true,
    frame:          false,
    alwaysOnTop:    true,
    skipTaskbar:    false,
    resizable:      false,
    hasShadow:      false,
    focusable:      true,  // needs to be focusable for clicks

    // Chromium flags for transparency
    backgroundColor: '#00000000',

    webPreferences: {
      nodeIntegration:     false,
      contextIsolation:    true,
      preload:             path.join(__dirname, 'preload.js'),
      webSecurity:         false,
    },
  });

  // Load app
  if (isDev) {
    overlayWindow.loadURL('http://localhost:5173');
    // overlayWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Always on top — set above everything including game
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');

  // Click-through by default — only accept clicks on interactive elements
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  // IPC: toggle mouse interaction
  ipcMain.on('set-ignore-mouse', (_, ignore) => {
    overlayWindow?.setIgnoreMouseEvents(ignore, { forward: true });
  });

  overlayWindow.on('closed', () => { overlayWindow = null; });
}

app.whenReady().then(() => {
  // Required for transparent overlay on Windows
  app.commandLine.appendSwitch('enable-transparent-visuals');
  createOverlayWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
