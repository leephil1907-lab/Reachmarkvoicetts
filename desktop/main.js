// Reachmark Audio — desktop shell (Electron)
// Pattern ported from debpalash/VoiceStudio/electron: single-window wrapper around the
// same web app + server, so desktop and browser share one codebase.
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let server = null;
const PORT = 8000;

function startServer() {
  server = spawn(process.execPath.includes('electron') ? 'node' : process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'inherit',
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 420, minHeight: 640,
    backgroundColor: '#151310', title: 'Reachmark Audio',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.loadURL(`http://127.0.0.1:${PORT}/`);
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  return win;
}

app.whenReady().then(() => {
  startServer();
  setTimeout(createWindow, 700);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('quit', () => { try { server?.kill(); } catch {} });
