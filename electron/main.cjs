const { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

const LOG_DIR = path.join(process.env.LOCALAPPDATA || process.cwd(), 'VoiceTyper', 'logs');
const LOG_FILE = path.join(LOG_DIR, `main-${new Date().toISOString().slice(0, 10)}.log`);
const APP_DATA_DIR = path.join(process.env.LOCALAPPDATA || process.cwd(), 'VoiceTyper');
const ELECTRON_DATA_DIR = path.join(APP_DATA_DIR, 'electron');
const ELECTRON_SESSION_DIR = path.join(ELECTRON_DATA_DIR, 'session');

function ensureLogDir() {
    try {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    } catch (_e) {
        // Ignore logging setup failures; app should still run.
    }
}

function safeStringify(value) {
    try {
        return typeof value === 'string' ? value : JSON.stringify(value);
    } catch (_e) {
        return String(value);
    }
}

function log(level, message, meta) {
    ensureLogDir();
    const ts = new Date().toISOString();
    const suffix = meta === undefined ? '' : ` ${safeStringify(meta)}`;
    const line = `[${ts}] [${level}] ${message}${suffix}\n`;
    try {
        fs.appendFileSync(LOG_FILE, line, 'utf8');
    } catch (_e) {
        // Ignore log write errors.
    }
    if (level === 'ERROR') {
        console.error(line.trim());
    } else if (level === 'WARN') {
        console.warn(line.trim());
    } else {
        console.log(line.trim());
    }
}

function redactCommand(cmd) {
    if (!cmd || typeof cmd !== 'object') return cmd;
    if (cmd.cmd !== 'set_config') return cmd;
    const cloned = { ...cmd, config: { ...(cmd.config || {}) } };
    if (cloned.config.asr_api_key) cloned.config.asr_api_key = '[REDACTED]';
    if (cloned.config.llm_api_key) cloned.config.llm_api_key = '[REDACTED]';
    return cloned;
}


// ===== Single Instance Lock =====
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
}

ensureLogDir();
try {
    fs.mkdirSync(ELECTRON_DATA_DIR, { recursive: true });
    fs.mkdirSync(ELECTRON_SESSION_DIR, { recursive: true });
    app.setPath('userData', ELECTRON_DATA_DIR);
    app.setPath('sessionData', ELECTRON_SESSION_DIR);
} catch (_e) {
    // Continue with Electron defaults if path override fails.
}

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-features', 'RendererCodeIntegrity,CalculateNativeWinOcclusion');

let mainWindow = null;
let overlayWindow = null;
let tray = null;
let pythonProcess = null;
let currentHotkey = 'F2';
let uiServer = null;
let uiServerUrl = '';
let lastHotkeyFireAt = {};
let holdReleaseTimers = {};
let activeHoldModes = new Set();
let hotkeyBehavior = {
    holdToRecord: false,
    blockInput: true,
};

const devServerUrl = process.env.VOICETYPER_DEV_SERVER_URL || '';
const isDev = !app.isPackaged && !!devServerUrl;
log('INFO', 'Main process boot', {
    isDev,
    devServerUrl,
    platform: process.platform,
    versions: process.versions,
    logFile: LOG_FILE,
});

process.on('uncaughtException', (err) => {
    log('ERROR', 'uncaughtException', { message: err?.message, stack: err?.stack });
});

process.on('unhandledRejection', (reason) => {
    log('ERROR', 'unhandledRejection', { reason: safeStringify(reason) });
});

// ===== Python Engine IPC =====

function startPythonEngine() {
    const pythonPath = 'python';
    const scriptPath = app.isPackaged
        ? path.join(process.resourcesPath, 'python', 'engine.py')
        : path.join(__dirname, '..', 'python', 'engine.py');

    try {
        log('INFO', 'Starting Python engine', { pythonPath, scriptPath });
        pythonProcess = spawn(pythonPath, [scriptPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env },
        });

        let buffer = '';
        pythonProcess.stdout.on('data', (data) => {
            buffer += data.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const event = JSON.parse(line);
                    if (event.event !== 'audio_level') {
                        log('INFO', 'Python event', event);
                    }
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('engine-event', event);
                    }
                    if (event.event === 'audio_level' && overlayWindow && !overlayWindow.isDestroyed()) {
                        overlayWindow.webContents.send('audio-level', event.level);
                    }
                } catch (e) {
                    log('WARN', 'Python stdout parse error', { line });
                }
            }
        });

        pythonProcess.stderr.on('data', (data) => {
            log('ERROR', 'Python stderr', data.toString());
        });

        pythonProcess.on('exit', (code) => {
            log('WARN', 'Python engine exited', { code });
            pythonProcess = null;
        });

        pythonProcess.on('error', (err) => {
            log('ERROR', 'Python spawn error', { message: err.message, stack: err.stack });
        });
    } catch (err) {
        log('ERROR', 'Python engine start failed', { message: err?.message, stack: err?.stack });
    }
}

function getRendererPaths() {
    if (app.isPackaged) {
        return {
            distDir: path.join(process.resourcesPath, 'dist'),
            overlayPath: path.join(process.resourcesPath, 'electron', 'overlay.html'),
        };
    }

    return {
        distDir: path.join(__dirname, '..', 'dist'),
        overlayPath: path.join(__dirname, 'overlay.html'),
    };
}

function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const map = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.ico': 'image/x-icon',
    };
    return map[ext] || 'application/octet-stream';
}

async function startUiServer() {
    if (uiServer) return uiServerUrl;

    const { distDir, overlayPath } = getRendererPaths();
    const indexPath = path.join(distDir, 'index.html');

    log('INFO', 'Starting local UI server', { distDir, overlayPath, indexPath });

    uiServer = http.createServer((req, res) => {
        const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
        const pathname = decodeURIComponent(reqUrl.pathname);
        const relativePath = pathname.replace(/^\/+/, '');

        let targetPath = indexPath;
        if (pathname === '/overlay') {
            targetPath = overlayPath;
        } else if (pathname.startsWith('/assets/')) {
            targetPath = path.join(distDir, relativePath);
        } else if (pathname !== '/' && pathname !== '/index.html') {
            targetPath = path.join(distDir, relativePath);
        }

        if (!targetPath.startsWith(distDir) && targetPath !== overlayPath) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        fs.readFile(targetPath, (err, content) => {
            if (err) {
                log('ERROR', 'UI server read failed', { pathname, targetPath, message: err.message });
                res.writeHead(404);
                res.end('Not Found');
                return;
            }

            res.writeHead(200, { 'Content-Type': getContentType(targetPath) });
            res.end(content);
        });
    });

    await new Promise((resolve, reject) => {
        uiServer.once('error', reject);
        uiServer.listen(0, '127.0.0.1', () => resolve());
    });

    const address = uiServer.address();
    uiServerUrl = `http://127.0.0.1:${address.port}`;
    log('INFO', 'Local UI server ready', { uiServerUrl });
    return uiServerUrl;
}

function stopUiServer() {
    if (!uiServer) return;
    uiServer.close();
    uiServer = null;
    uiServerUrl = '';
}

function sendToEngine(cmd) {
    if (pythonProcess && pythonProcess.stdin.writable) {
        log('INFO', 'Send to engine', redactCommand(cmd));
        pythonProcess.stdin.write(JSON.stringify(cmd) + '\n');
    } else {
        log('WARN', 'Send to engine dropped: python stdin not writable');
    }
}

function stopPythonEngine() {
    if (pythonProcess) {
        sendToEngine({ cmd: 'quit' });
        setTimeout(() => {
            if (pythonProcess) {
                pythonProcess.kill();
                pythonProcess = null;
            }
        }, 2000);
    }
}

// ===== IPC Handlers =====

ipcMain.handle('engine-command', (_event, cmd) => {
    log('INFO', 'IPC engine-command', redactCommand(cmd));
    sendToEngine(cmd);
    return true;
});

ipcMain.handle('engine-status', () => {
    return { running: pythonProcess !== null };
});

// Renderer calls this when user changes hotkey in Settings
ipcMain.handle('update-hotkey', (_event, newKey) => {
    log('INFO', 'IPC update-hotkey', newKey);
    registerHotkeys(newKey);
    return true;
});

// Overlay IPC
ipcMain.handle('show-overlay', () => {
    if (overlayWindow) {
        overlayWindow.setOpacity(1);
        overlayWindow.setIgnoreMouseEvents(false);
    }
});

ipcMain.handle('update-overlay', (_, state) => {
    if (overlayWindow) {
        overlayWindow.webContents.send('overlay-state', state);
        if (state.visible) {
            overlayWindow.setOpacity(1);
            overlayWindow.setIgnoreMouseEvents(false);
        } else {
            overlayWindow.setOpacity(0);
            overlayWindow.setIgnoreMouseEvents(true);
        }
    }
});

ipcMain.handle('hide-overlay', () => {
    if (overlayWindow) {
        overlayWindow.setOpacity(0);
        overlayWindow.setIgnoreMouseEvents(true);
    }
});

// ===== Create Tray Icon (16x16 blue mic) =====

function createTrayIcon() {
    const size = 16;
    const canvas = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const idx = (y * size + x) * 4;
            const cx = x - size / 2;
            const cy = y - size / 2;
            const dist = Math.sqrt(cx * cx + cy * cy);
            if (dist < size / 2 - 1) {
                canvas[idx] = 59;
                canvas[idx + 1] = 130;
                canvas[idx + 2] = 246;
                canvas[idx + 3] = 255;
            } else {
                canvas[idx + 3] = 0;
            }
        }
    }
    return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

// ===== Window =====

function createOverlayWindow() {
    log('INFO', 'Creating overlay window');
    overlayWindow = new BrowserWindow({
        width: 160,
        height: 48,
        backgroundColor: '#2c2c2e',
        frame: false,
        hasShadow: false,
        roundedCorners: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        show: false,
        opacity: 0,
        focusable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
    });

    // Position at bottom center immediately
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    overlayWindow.setPosition(
        Math.round((width - 180) / 2),
        height - 150
    );
    // Start with mouse pass-through since it's invisible
    overlayWindow.setIgnoreMouseEvents(true);

    overlayWindow.webContents.on('did-finish-load', () => {
        log('INFO', 'Overlay window loaded');
    });
    overlayWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
        log('INFO', 'Overlay console', { level, message, line, sourceId });
    });
    overlayWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
        log('ERROR', 'Overlay preload-error', { preloadPath, message: error?.message, stack: error?.stack });
    });
    overlayWindow.webContents.on('did-fail-load', (_event, code, desc, url) => {
        log('ERROR', 'Overlay did-fail-load', { code, desc, url });
    });

    overlayWindow.loadURL(`${uiServerUrl}/overlay`).catch((err) => {
        log('ERROR', 'Overlay loadURL failed', { message: err?.message, stack: err?.stack, uiServerUrl });
    });

    overlayWindow.once('ready-to-show', () => {
        overlayWindow.show();
    });
}

function createWindow() {
    log('INFO', 'Creating main window');
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: 'VoiceTyper',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs'),
        },
        show: false,
        backgroundColor: '#1c1f26',
    });

    mainWindow.webContents.on('did-finish-load', () => {
        log('INFO', 'Main window loaded');
    });
    mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
        log('INFO', 'Main console', { level, message, line, sourceId });
    });
    mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
        log('ERROR', 'Main preload-error', { preloadPath, message: error?.message, stack: error?.stack });
    });
    mainWindow.webContents.on('did-fail-load', (_event, code, desc, url) => {
        log('ERROR', 'Main did-fail-load', { code, desc, url });
    });
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
        log('ERROR', 'Renderer process gone', details);
    });

    if (isDev) {
        mainWindow.loadURL(devServerUrl).catch((err) => {
            log('WARN', 'Dev server unavailable, fallback to dist build', { message: err?.message });
            mainWindow.loadURL(uiServerUrl).catch((fallbackErr) => {
                log('ERROR', 'Fallback loadURL failed', { message: fallbackErr?.message, stack: fallbackErr?.stack, uiServerUrl });
            });
        });
    } else {
        mainWindow.loadURL(uiServerUrl).catch((err) => {
            log('ERROR', 'loadURL failed', { message: err?.message, stack: err?.stack, uiServerUrl });
        });
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('close', (e) => {
        if (!app.isQuitting) {
            e.preventDefault();
            mainWindow.hide();
        }
    });
}

// ===== Global Hotkey =====
// Use Electron globalShortcut for stability across Electron versions.

let currentHotkeys = {}; // { mode: { accelerator: string, rawKey: string } }

const ACCELERATOR_MAP = {
    alt: 'Alt',
    rightalt: 'Alt',
    ctrl: 'Control',
    control: 'Control',
    rightctrl: 'Control',
    shift: 'Shift',
    rightshift: 'Shift',
    meta: process.platform === 'darwin' ? 'Command' : 'Super',
    win: process.platform === 'darwin' ? 'Command' : 'Super',
    command: 'Command',
    commandorcontrol: process.platform === 'darwin' ? 'Command' : 'Control',
    enter: 'Enter',
    return: 'Enter',
    escape: 'Esc',
    esc: 'Esc',
    space: 'Space',
    tab: 'Tab',
};

function toAcceleratorToken(token) {
    if (!token) return null;
    const normalized = token.trim().toLowerCase();
    if (!normalized) return null;
    if (ACCELERATOR_MAP[normalized]) return ACCELERATOR_MAP[normalized];
    if (/^f\d{1,2}$/.test(normalized)) return normalized.toUpperCase();
    if (/^[a-z]$/.test(normalized)) return normalized.toUpperCase();
    if (/^\d$/.test(normalized)) return normalized;
    return token.trim();
}

function parseAccelerator(comboStr) {
    if (!comboStr || comboStr.toLowerCase() === 'none') return null;
    const parts = comboStr.split('+').map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) return null;
    const tokens = parts.map(toAcceleratorToken).filter(Boolean);
    const modifierOnly = tokens.length === 1 && ['Alt', 'Control', 'Shift', 'Command', 'Super'].includes(tokens[0]);
    if (modifierOnly) return null;
    return tokens.length > 0 ? tokens.join('+') : null;
}

function normalizeHotkeyConfig(hotkeyConfig) {
    if (!hotkeyConfig) return null;
    if (typeof hotkeyConfig === 'string') {
        return {
            voiceInput: hotkeyConfig,
            handsfree: 'Space',
            translate: 'Alt+T',
            holdToRecord: false,
            blockInput: true,
        };
    }
    return hotkeyConfig;
}

function emitHotkeyEvent(mode, type) {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const rawKey = currentHotkeys[mode]?.rawKey || mode;
    mainWindow.webContents.send('hotkey-event', { key: rawKey, mode, type });
}

function registerHotkeys(hotkeyConfig) {
    log('INFO', 'Registering hotkeys', hotkeyConfig);
    currentHotkeys = {};
    lastHotkeyFireAt = {};
    activeHoldModes.clear();
    for (const t of Object.values(holdReleaseTimers)) clearTimeout(t);
    holdReleaseTimers = {};
    globalShortcut.unregisterAll();

    const normalizedConfig = normalizeHotkeyConfig(hotkeyConfig);
    if (!normalizedConfig) return;
    hotkeyBehavior.holdToRecord = !!normalizedConfig.holdToRecord;
    hotkeyBehavior.blockInput = normalizedConfig.blockInput !== false;

    const modes = ['voiceInput', 'handsfree', 'translate'];
    modes.forEach((mode) => {
        const rawKey = normalizedConfig[mode];
        const accelerator = parseAccelerator(rawKey);
        if (!accelerator) {
            log('WARN', `Hotkey skipped for ${mode}`, { rawKey });
            return;
        }

        try {
            const ok = globalShortcut.register(accelerator, () => {
                const isHoldMode = mode === 'voiceInput'
                    ? hotkeyBehavior.holdToRecord
                    : mode === 'translate'
                        ? hotkeyBehavior.holdToRecord
                        : false;
                if (isHoldMode) {
                    const wasActive = activeHoldModes.has(mode);
                    if (!wasActive) {
                        activeHoldModes.add(mode);
                    }
                    // Emit keydown as heartbeat while key repeat events continue.
                    emitHotkeyEvent(mode, 'keydown');
                    clearTimeout(holdReleaseTimers[mode]);
                    // globalShortcut has no keyup event. We infer "release" when repeat callbacks stop.
                    holdReleaseTimers[mode] = setTimeout(() => {
                        if (activeHoldModes.has(mode)) {
                            activeHoldModes.delete(mode);
                            emitHotkeyEvent(mode, 'keyup');
                        }
                    }, 220);
                    return;
                }

                const now = Date.now();
                const lastAt = lastHotkeyFireAt[mode] || 0;
                if (now - lastAt < 350) {
                    return;
                }
                lastHotkeyFireAt[mode] = now;
                emitHotkeyEvent(mode, 'keydown');
            });

            if (!ok) {
                log('WARN', `Hotkey register failed for ${mode}`, { accelerator });
                return;
            }

            log('INFO', `Hotkey registered for ${mode}`, { accelerator });
            currentHotkeys[mode] = { accelerator, rawKey };
        } catch (err) {
            log('ERROR', `Hotkey register threw for ${mode}`, { accelerator, message: err?.message, stack: err?.stack });
        }
    });
}

// ===== System Tray =====

function createTray() {
    const icon = createTrayIcon();
    tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
        {
            label: '显示 VoiceTyper',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            },
        },
        { type: 'separator' },
        {
            label: '退出',
            click: () => {
                app.isQuitting = true;
                stopPythonEngine();
                app.quit();
            },
        },
    ]);

    tray.setToolTip('VoiceTyper - 语音输入助手');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

// ===== App Lifecycle =====

app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
    }
});

app.whenReady().then(async () => {
    log('INFO', 'App ready');
    await startUiServer();
    createWindow();
    createOverlayWindow();
    createTray();
    registerHotkeys({
        voiceInput: 'F2',
        handsfree: 'Space',
        translate: 'Alt+T',
        holdToRecord: false,
        blockInput: true,
    });
    startPythonEngine();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
            createOverlayWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        stopUiServer();
        stopPythonEngine();
        app.quit();
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    stopUiServer();
    stopPythonEngine();
});
