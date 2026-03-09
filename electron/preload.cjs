const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Engine commands
    sendCommand: (cmd) => ipcRenderer.invoke('engine-command', cmd),
    getEngineStatus: () => ipcRenderer.invoke('engine-status'),

    // Update hotkeys from Settings page
    updateHotkeys: (keysObj) => ipcRenderer.invoke('update-hotkey', keysObj),

    // Overlay controls
    showOverlay: () => ipcRenderer.invoke('show-overlay'),
    hideOverlay: () => ipcRenderer.invoke('hide-overlay'),
    updateOverlay: (state) => ipcRenderer.invoke('update-overlay', state),

    // Listen for engine events (transcription, status, errors)
    onEngineEvent: (callback) => {
        ipcRenderer.on('engine-event', (_event, data) => callback(data));
    },

    // Listen for global hotkey events (keydown / keyup for hold-to-record)
    onHotkeyEvent: (callback) => {
        ipcRenderer.on('hotkey-event', (_event, data) => callback(data));
    },

    // Legacy: keep for compatibility
    onHotkeyPressed: (callback) => {
        ipcRenderer.on('hotkey-event', (_event, data) => {
            if (data.type === 'keydown') callback(data);
        });
    },

    // Remove listeners
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    },

    // Platform info
    platform: process.platform,
});
