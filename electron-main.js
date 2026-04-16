const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: false, // Security best practice
      contextIsolation: true
    },
    autoHideMenuBar: true,
    show: false // Wait to show until loaded
  });

  win.setMenuBarVisibility(false);

  // In production, load the built dist folder
  // In dev, you might load localhost:5174, but for an executable we focus on the build
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5174');
  } else {
    win.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  // Gracefully show to avoid white flash
  win.once('ready-to-show', () => {
    win.show();
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
