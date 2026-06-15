const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execFile } = require('child_process');

const isDev = process.env.NODE_ENV === 'development';

// Launched by Windows at login (we register the login item with this flag) →
// start silently in the tray, don't pop the main window.
const isAutoLaunch = process.argv.includes('--autostart');

app.setName('DotaVIP');

// Single instance — autostart at login + a manual launch must not run twice.
// Second launch just brings up the main window of the running instance.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => openSettings());
}

// ── Windows autostart (login item) ───────────────────────────────────────────
// Enabled BY DEFAULT on first run (per user; Windows login items are always
// per-user — every user who runs the app once gets autostart out of the box).
// The chosen value persists in userData/settings.json — that file is the
// source of truth (also makes the toggle work in dev, where we deliberately
// never register the dev electron.exe as a real Windows login item).
const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'settings.json');

function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE(), 'utf8')); }
  catch { return null; }   // missing / corrupt = first run
}

function writeSettings(patch) {
  const next = { ...(readSettings() || {}), ...patch };
  try { fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(next, null, 2)); }
  catch (e) { console.error('settings write failed', e); }
  return next;
}

// The user-facing launcher (winexe) at the project root. In dev this is what
// must autostart — NOT the dev electron.exe (which has no backend/vite around
// it). In production there is no separate launcher: the installed app exe IS
// the entry point, so we register process.execPath with --autostart.
function launcherPath() {
  return path.join(__dirname, '..', '..', 'DotaVIP.exe');
}

function applyLoginItem(enabled) {
  const opts = { openAtLogin: !!enabled };
  if (isDev) {
    const launcher = launcherPath();
    if (!fs.existsSync(launcher)) {
      console.error('autostart: launcher not found at', launcher);
      return;
    }
    opts.path = launcher;    // Windows: register the winexe launcher
  } else {
    opts.args = ['--autostart'];
  }
  app.setLoginItemSettings(opts);
}

function getAutostart() {
  const s = readSettings();
  if (s && typeof s.autostart === 'boolean') return s.autostart;
  return true;               // no saved preference yet → default is ON
}

function setAutostart(enabled) {
  writeSettings({ autostart: !!enabled });
  applyLoginItem(enabled);
}

function initAutostartDefault() {
  const s = readSettings();
  if (!s || typeof s.autostart !== 'boolean') {
    setAutostart(true);                 // first run for this user → enable
  } else {
    applyLoginItem(s.autostart);        // re-assert (e.g. app moved/updated)
  }
}

ipcMain.handle('get-autostart', () => getAutostart());
ipcMain.handle('set-autostart', (_e, enabled) => { setAutostart(enabled); return getAutostart(); });

let overlayWindow  = null;
let settingsWindow = null;
let tray           = null;
let focusProc      = null;
let backendProc    = null;
let visible        = false;

// ── Bundled Python backend (production) ──────────────────────────────────────
// In production we ship backend.exe (PyInstaller). In dev the backend is run
// manually (uvicorn). Start it before the windows load.
function startBackend() {
  if (isDev) return;                       // dev: run uvicorn yourself
  const exe = path.join(process.resourcesPath, 'backend', 'dotavip-backend.exe');
  try {
    backendProc = spawn(exe, [], { cwd: path.dirname(exe), windowsHide: true });
    backendProc.on('error', e => console.error('backend spawn error', e));
  } catch (e) {
    console.error('failed to start backend', e);
  }
}

// ── Auto-updater ─────────────────────────────────────────────────────────────
// Uses electron-updater + GitHub Releases. In dev mode updater is disabled.
// Download happens in the background; install is DEFERRED until dota2.exe
// is not running (checked every 5 min) so we never interrupt an active game.
let _updateReady  = false;
let _updateStatus = 'idle';   // idle | checking | up-to-date | available | downloading | ready | error
let _updateCheckInterval = null;
let _dotaCheckInterval   = null;

function isDotaRunning(cb) {
  execFile('tasklist', ['/FI', 'IMAGENAME eq dota2.exe', '/NH', '/FO', 'CSV'],
    { windowsHide: true },
    (err, stdout) => cb(!err && stdout.toLowerCase().includes('dota2.exe'))
  );
}

function scheduleInstallWhenDotaClosed() {
  if (_dotaCheckInterval) return;
  _dotaCheckInterval = setInterval(() => {
    isDotaRunning(running => {
      if (!running) {
        clearInterval(_dotaCheckInterval);
        _dotaCheckInterval = null;
        const { autoUpdater } = require('electron-updater');
        autoUpdater.quitAndInstall(true, true);
      }
    });
  }, 5 * 60 * 1000); // check every 5 min
}

function initAutoUpdater() {
  if (isDev) return;
  const { autoUpdater } = require('electron-updater');

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update',  () => { _updateStatus = 'checking'; });
  autoUpdater.on('update-not-available', () => { _updateStatus = 'up-to-date'; });
  autoUpdater.on('update-available',     () => { _updateStatus = 'available'; });
  autoUpdater.on('download-progress',    () => { _updateStatus = 'downloading'; });
  autoUpdater.on('error',                () => { _updateStatus = 'error'; });

  autoUpdater.on('update-downloaded', () => {
    _updateReady  = true;
    _updateStatus = 'ready';
    isDotaRunning(running => {
      if (running) {
        tray?.setToolTip('DotaVIP — оновлення готове (буде встановлено після закриття Dota)');
        scheduleInstallWhenDotaClosed();
      } else {
        autoUpdater.quitAndInstall(true, true);
      }
    });
  });

  // Check on startup after a short delay, then every 4 hours.
  setTimeout(() => autoUpdater.checkForUpdates(), 15_000);
  _updateCheckInterval = setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000);

  ipcMain.handle('check-for-updates', () => {
    autoUpdater.checkForUpdates().catch(() => {});
  });
}

ipcMain.handle('get-app-version',   () => app.getVersion());
ipcMain.handle('get-update-ready',  () => _updateReady);
ipcMain.handle('get-update-status', () => _updateStatus);
ipcMain.handle('install-update-now', () => {
  if (!_updateReady) return false;
  const { autoUpdater } = require('electron-updater');
  clearInterval(_dotaCheckInterval); _dotaCheckInterval = null;
  autoUpdater.quitAndInstall(true, true);
  return true;
});

// ── GPU compositing ON ──────────────────────────────────────────────────────
// A transparent fullscreen overlay MUST be GPU-composited. Software rendering
// forces the CPU to paint the whole screen every frame (that was the FPS
// killer). GPU compositing of a transparent layer is nearly free — same as
// how Discord/Steam/Overwolf overlays stay smooth.
app.commandLine.appendSwitch('v8-code-cache-dir', path.join(app.getPath('userData'), 'v8-cache'));

function setVisible(show) {
  if (!overlayWindow || show === visible) return;
  visible = show;
  if (show) {
    overlayWindow.showInactive();                       // show without stealing game focus
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  } else {
    overlayWindow.hide();
  }
}

/**
 * Spawn the long-lived foreground monitor. It streams the focused process
 * name; we show the overlay only when Dota is the focused window.
 * One persistent process → no per-tick spawn cost → no mouse lag.
 */
function startFocusMonitor() {
  // In production the PS1 is unpacked from asar → must use the .unpacked path.
  // __dirname inside app.asar is a virtual path PowerShell cannot read.
  const script = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'focus_monitor.ps1')
    : path.join(__dirname, 'focus_monitor.ps1');

  console.log('[focus] script path:', script);
  console.log('[focus] exists:', fs.existsSync(script));

  focusProc = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script],
    { windowsHide: true });

  focusProc.stderr.on('data', d => console.error('[focus stderr]', d.toString()));

  let buf = '';
  focusProc.stdout.on('data', chunk => {
    buf += chunk.toString();
    const lines = buf.split(/\r?\n/);
    buf = lines.pop();                                   // keep partial line
    for (const line of lines) {
      const name = line.trim().toLowerCase();
      if (name === '') continue;                         // ignore empty ticks
      setVisible(name === 'dota2');
    }
  });

  focusProc.on('exit', (code) => { console.log('[focus] exited', code); focusProc = null; });
}

function createOverlayWindow() {
  // Borderless Dota fills its monitor → overlay covers the primary display.
  const display = screen.getPrimaryDisplay();
  const { x, y, width, height } = display.bounds;

  overlayWindow = new BrowserWindow({
    x, y, width, height,
    transparent:   true,
    frame:         false,
    alwaysOnTop:   true,
    skipTaskbar:   true,
    resizable:     false,
    hasShadow:     false,
    // focusable:false → window receives clicks but NEVER takes focus from the
    // game (Windows WS_EX_NOACTIVATE). This is how Overwolf overlays behave:
    // clicking our buttons no longer alt-tabs out of Dota.
    focusable:     false,
    show:          false,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      preload:          path.join(__dirname, 'preload.cjs'),
      webSecurity:      false,
      sandbox:          true,
    },
  });

  if (isDev) {
    overlayWindow.loadURL('http://localhost:5173');
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  // Force the window to cover the FULL monitor, including the taskbar area.
  // Electron otherwise clamps frameless windows to the work area (excluding
  // the ~40px taskbar), which made the bottom of the screen unusable.
  overlayWindow.once('ready-to-show', () => {
    overlayWindow.setBounds({ x, y, width, height });
  });
  overlayWindow.setBounds({ x, y, width, height });

  // Renderer toggles mouse interaction when hovering an interactive widget
  ipcMain.on('set-ignore-mouse', (_e, ignore) => {
    overlayWindow?.setIgnoreMouseEvents(ignore, { forward: true });
  });

  startFocusMonitor();

  overlayWindow.on('closed', () => {
    overlayWindow = null;
    if (focusProc) { focusProc.kill(); focusProc = null; }
  });
}

// ── Settings / main menu window ──────────────────────────────────────────────
function openSettings() {
  if (settingsWindow) { settingsWindow.show(); settingsWindow.focus(); return; }

  settingsWindow = new BrowserWindow({
    width: 1100, height: 760,
    minWidth: 900, minHeight: 600,
    title: 'DotaVIP',
    autoHideMenuBar: true,
    backgroundColor: '#0b0f17',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          true,
    },
  });
  settingsWindow.maximize();   // open large so all content is visible

  if (isDev) {
    settingsWindow.loadURL('http://localhost:5173/?window=settings');
  } else {
    settingsWindow.loadFile(path.join(__dirname, '../dist/index.html'), { search: 'window=settings' });
  }

  settingsWindow.on('closed', () => { settingsWindow = null; });
}

// ── System tray (bottom-right Windows tray) ─────────────────────────────────
function createTray() {
  const iconPath = isDev
    ? path.join(__dirname, '..', 'public', 'rosh', 'Roshan.png')
    : path.join(__dirname, '..', 'dist', 'rosh', 'Roshan.png');
  let icon = nativeImage.createFromPath(iconPath);
  if (!icon.isEmpty()) icon = icon.resize({ width: 18, height: 18 });

  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('DotaVIP');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Відкрити DotaVIP', click: openSettings },
    { type: 'separator' },
    { label: 'Вийти', click: () => { app.isQuitting = true; app.quit(); } },
  ]));
  tray.on('click', openSettings);
}

app.on('before-quit', () => {
  app.isQuitting = true;
  if (focusProc) focusProc.kill();
});

app.whenReady().then(() => {
  initAutostartDefault();
  startBackend();
  createOverlayWindow();
  createTray();
  initAutoUpdater();
  // Normal launch → show the main window. Autostart at Windows login → stay
  // silently in the tray (the overlay still appears when Dota is focused).
  if (!isAutoLaunch) openSettings();
});

app.on('before-quit', () => { if (backendProc) try { backendProc.kill(); } catch {} });

// Tray app — keep running even if all windows are closed. Quit only via tray.
app.on('window-all-closed', () => {});
