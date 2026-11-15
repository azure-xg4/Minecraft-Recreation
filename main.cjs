const { app, BrowserWindow } = require("electron");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "BlockWorld",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile("index.html");
}

app.whenReady().then(createWindow);
