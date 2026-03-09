/**
 * Type declarations for the Electron API exposed via preload.cjs
 */

interface EngineEvent {
    event: string;
    text?: string;
    message?: string;
    is_silent?: boolean;
    config?: Record<string, unknown>;
    mode?: string;
    target?: string;
    stage?: string;
    percent?: number;
    downloaded_mb?: number;
    total_mb?: number;
    speed_mbps?: number;
    llm_available?: boolean;
    level?: number;
    model?: string;
    path?: string;
    options?: string[];
}

interface HotkeyEvent {
    key: string;
    type?: 'keydown' | 'keyup';
}

interface ElectronAPI {
    sendCommand: (cmd: { cmd: string;[key: string]: unknown }) => Promise<boolean>;
    getEngineStatus: () => Promise<{ running: boolean }>;
    updateHotkeys: (keys: Record<string, string | boolean>) => Promise<boolean>;
    showOverlay: () => Promise<void>;
    hideOverlay: () => Promise<void>;
    updateOverlay?: (state: { visible: boolean; status: string; text?: string }) => Promise<void>;
    onEngineEvent: (callback: (data: EngineEvent) => void) => void;
    onHotkeyEvent: (callback: (data: HotkeyEvent) => void) => void;
    onHotkeyPressed: (callback: (data: HotkeyEvent) => void) => void;
    removeAllListeners: (channel: string) => void;
    platform: string;
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
    }
}

export { };
