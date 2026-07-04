const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');
const http = require('http');

let mainWindow;
let serverProcess;
let backendLogStream;

const isDev = !app.isPackaged;
const BACKEND_PORT = 3001;
const FRONTEND_DEV_URL = 'http://localhost:5173/index.html';
const BACKEND_HEALTH_URL = `http://127.0.0.1:${BACKEND_PORT}/api/health`;
const BACKEND_STARTUP_TIMEOUT_MS = 30000;

app.setName('U2 Collective CRM');
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
if (process.env.U2_CRM_DEBUG_PORT) {
  app.commandLine.appendSwitch('remote-debugging-port', process.env.U2_CRM_DEBUG_PORT);
}

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getAssetPath(fileName) {
  return path.join(app.getAppPath(), isDev ? 'public' : 'dist', fileName);
}

function getServerPath() {
  return isDev
    ? path.join(app.getAppPath(), 'server', 'index.js')
    : path.join(process.resourcesPath, 'server', 'index.js');
}

function writeBackendLog(message) {
  if (!backendLogStream) return;
  backendLogStream.write(`[${new Date().toISOString()}] ${message}\n`);
}

function writeStartupLog(message) {
  try {
    const logsDir = path.join(app.getPath('userData'), 'logs');
    ensureDir(logsDir);
    fs.appendFileSync(path.join(logsDir, 'main.log'), `[${new Date().toISOString()}] ${message}\n`);
  } catch (err) {
    console.error(err);
  }
}

function waitForUrl(url, timeoutMs = BACKEND_STARTUP_TIMEOUT_MS) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body);
            return;
          }
          retry();
        });
      });

      req.on('error', retry);
      req.setTimeout(1000, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(attempt, 300);
    };

    attempt();
  });
}

function checkUrl(url, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 300);
    });

    req.on('error', () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function startServer() {
  const userDataDir = app.getPath('userData');
  const serverPath = getServerPath();
  const serverRoot = path.dirname(serverPath);
  const uploadsDir = path.join(userDataDir, 'uploads');
  const backupsDir = path.join(userDataDir, 'backups');
  const logsDir = path.join(userDataDir, 'logs');

  if (!fs.existsSync(serverPath)) {
    throw new Error(`Server entry not found: ${serverPath}`);
  }

  [uploadsDir, backupsDir, logsDir].forEach(ensureDir);

  backendLogStream = fs.createWriteStream(path.join(logsDir, 'backend.log'), { flags: 'a' });
  if (await checkUrl(BACKEND_HEALTH_URL)) {
    writeBackendLog(`Reusing existing healthy backend on ${BACKEND_HEALTH_URL}`);
    return;
  }

  writeBackendLog(`Starting backend from ${serverPath}`);
  writeBackendLog('Database provider: Supabase');
  writeBackendLog(`Uploads path: ${uploadsDir}`);
  writeBackendLog(`Backups path: ${backupsDir}`);

  serverProcess = fork(serverPath, [], {
    cwd: serverRoot,
    env: {
      ...process.env,
      PORT: String(BACKEND_PORT),
      NODE_ENV: isDev ? 'development' : 'production',
      NODE_PATH: path.join(app.getAppPath(), 'node_modules'),
      UPLOADS_DIR: uploadsDir,
      BACKUPS_DIR: backupsDir,
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
      QURAN_REFRESH_TOKEN: process.env.QURAN_REFRESH_TOKEN
    },
    silent: true
  });

  serverProcess.stdout?.on('data', (data) => writeBackendLog(data.toString().trimEnd()));
  serverProcess.stderr?.on('data', (data) => writeBackendLog(`ERROR ${data.toString().trimEnd()}`));
  serverProcess.on('error', (err) => writeBackendLog(`PROCESS ERROR ${err.stack || err.message}`));
  serverProcess.on('exit', (code, signal) => {
    writeBackendLog(`Server process exited with code ${code}, signal ${signal}`);
    serverProcess = null;
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }

  if (backendLogStream) {
    backendLogStream.end();
    backendLogStream = null;
  }
}

async function showLoadingScreen() {
  const loadingPath = path.join(app.getAppPath(), 'electron', 'loading.html');
  if (fs.existsSync(loadingPath)) {
    await mainWindow.loadFile(loadingPath);
    writeStartupLog(`Loading screen loaded: ${loadingPath}`);
  }
}

async function loadFrontend() {
  try {
    await waitForUrl(BACKEND_HEALTH_URL, BACKEND_STARTUP_TIMEOUT_MS);
  } catch (err) {
    const logPath = path.join(app.getPath('userData'), 'logs', 'backend.log');
    writeBackendLog(`STARTUP TIMEOUT ${err.stack || err.message}`);
    dialog.showErrorBox(
      'U2 CRM Server Error',
      `The local CRM backend did not start within 30 seconds.\n\nA backend log was written to:\n${logPath}`
    );
    app.quit();
    return;
  }

  if (isDev) {
    try {
      await waitForUrl(FRONTEND_DEV_URL, 2500);
      await mainWindow.loadURL(FRONTEND_DEV_URL);
      writeStartupLog(`Frontend loaded from ${FRONTEND_DEV_URL}`);
      mainWindow.webContents.openDevTools({ mode: 'detach' });
      return;
    } catch (err) {
      writeBackendLog('Vite dev server not detected; loading built frontend.');
    }
  }

  const indexPath = path.join(app.getAppPath(), 'dist', 'index.html');
  if (!fs.existsSync(indexPath)) {
    dialog.showErrorBox(
      'U2 CRM Frontend Missing',
      'The React frontend build was not found. Run "npm run build" once, or use "npm run dev" while developing.'
    );
    app.quit();
    return;
  }

  await mainWindow.loadFile(indexPath, { hash: '/' });
  writeStartupLog(`Frontend loaded from ${indexPath}#/`);
}

async function initializeWindow() {
  try {
    await showLoadingScreen();
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    await loadFrontend();
  } catch (err) {
    writeStartupLog(`Window initialization error: ${err.stack || err.message}`);
    dialog.showErrorBox('U2 CRM Startup Error', err.message);
    app.quit();
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#F8FAFC',
    titleBarStyle: 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false,
    autoHideMenuBar: true,
    icon: getAssetPath('app icon.png')
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    writeStartupLog(`Renderer failed to load: ${errorCode} ${errorDescription} ${validatedURL}`);
    if (validatedURL !== BACKEND_HEALTH_URL) {
      const indexPath = path.join(app.getAppPath(), 'dist', 'index.html');
      if (!isDev && fs.existsSync(indexPath)) {
        mainWindow.loadFile(indexPath, { hash: '/' });
      }
    }
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    writeStartupLog(`Renderer process gone: ${details.reason}, exitCode=${details.exitCode}`);
    if (!mainWindow.isDestroyed()) {
      loadFrontend();
    }
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level >= 2) {
      writeStartupLog(`Renderer console: ${message} (${sourceId}:${line})`);
    }
  });

  initializeWindow();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  if (!singleInstanceLock) return;

  try {
    writeStartupLog(`App ready. isPackaged=${app.isPackaged}, appPath=${app.getAppPath()}, resourcesPath=${process.resourcesPath}`);
    await startServer();
    createWindow();
  } catch (err) {
    writeStartupLog(`Startup error: ${err.stack || err.message}`);
    dialog.showErrorBox('U2 CRM Startup Error', err.message);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopServer();
});

ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-user-data-path', () => app.getPath('userData'));
ipcMain.handle('show-save-dialog', async (event, options) => dialog.showSaveDialog(mainWindow, options));
ipcMain.handle('show-open-dialog', async (event, options) => dialog.showOpenDialog(mainWindow, options));
