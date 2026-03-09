/**
 * React hook for communicating with the Python voice engine via Electron IPC.
 * Falls back gracefully when running in a browser (non-Electron) context.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { addHistoryItem, getConfig, updateConfig } from './storage';

export interface EngineState {
    isElectron: boolean;
    engineRunning: boolean;
    llmAvailable: boolean;
    llmAvailabilityKnown: boolean;
    isRecording: boolean;
    isProcessing: boolean;
    lastTranscription: string;
    lastPolished: string;
    lastWordCount: number;
    statusMessage: string;
    error: string;
    asrDownloadActive: boolean;
    asrDownloadPercent: number;
    asrDownloadModel: string;
    asrDownloadDownloadedMB: number;
    asrDownloadTotalMB: number;
    asrDownloadSpeedMBps: number;
    asrInstallRequired: boolean;
    asrInstallOptions: string[];
    asrPreparingModel: string;
}

function inferLlmAvailableFromConfig(engineCfg: Record<string, unknown>): boolean {
    const backend = String(engineCfg.llm_backend || '').toLowerCase();
    if (backend === 'api') {
        return !!engineCfg.llm_api_url && !!engineCfg.llm_api_key;
    }
    if (backend === 'local') {
        // Local backend is considered configured; final availability comes from capabilities.
        return true;
    }
    return false;
}

export function useVoiceEngine() {
    const SILENCE_TIMEOUT_MS = 5000;
    const AUDIO_ACTIVE_THRESHOLD = 3;

    const [state, setState] = useState<EngineState>({
        isElectron: false,
        engineRunning: false,
        llmAvailable: false,
        llmAvailabilityKnown: false,
        isRecording: false,
        isProcessing: false,
        lastTranscription: '',
        lastPolished: '',
        lastWordCount: 0,
        statusMessage: '正在初始化引擎...',
        error: '',
        asrDownloadActive: false,
        asrDownloadPercent: 0,
        asrDownloadModel: '',
        asrDownloadDownloadedMB: 0,
        asrDownloadTotalMB: 0,
        asrDownloadSpeedMBps: 0,
        asrInstallRequired: false,
        asrInstallOptions: ['whisper-tiny', 'whisper-base', 'whisper-small'],
        asrPreparingModel: '',
    });

    const recordingStartTime = useRef<number>(0);
    const isTogglingRef = useRef(false);
    const pendingStartRef = useRef(false);
    const holdStopTimersRef = useRef<Record<string, number>>({});
    const silenceMonitorTimerRef = useRef<number | null>(null);
    const lastAudioActivityAtRef = useRef<number>(0);
    const activeRecordingModeRef = useRef<string>('normal');
    const silenceAutoStopTriggeredRef = useRef(false);
    const stateRef = useRef(state);
    stateRef.current = state;

    const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

    const clearSilenceMonitor = useCallback(() => {
        if (silenceMonitorTimerRef.current) {
            window.clearInterval(silenceMonitorTimerRef.current);
            silenceMonitorTimerRef.current = null;
        }
        silenceAutoStopTriggeredRef.current = false;
    }, []);

    const isToggleRecordingMode = useCallback((mode: string) => {
        const cfg = getConfig();
        if (mode === 'handsfree') return true;
        if (mode === 'translate') return !cfg.holdToRecord;
        if (mode === 'normal') return !cfg.holdToRecord;
        return false;
    }, []);

    const startSilenceMonitor = useCallback((mode: string) => {
        clearSilenceMonitor();
        if (!isToggleRecordingMode(mode)) return;

        lastAudioActivityAtRef.current = Date.now();
        silenceAutoStopTriggeredRef.current = false;

        silenceMonitorTimerRef.current = window.setInterval(() => {
            if (!stateRef.current.isRecording || stateRef.current.isProcessing) return;
            if (silenceAutoStopTriggeredRef.current) return;

            const idleMs = Date.now() - lastAudioActivityAtRef.current;
            if (idleMs < SILENCE_TIMEOUT_MS) return;

            silenceAutoStopTriggeredRef.current = true;
            pendingStartRef.current = false;
            window.electronAPI?.sendCommand?.({ cmd: 'stop_recording' });
            setState(prev => ({ ...prev, statusMessage: '静音超时，已自动停止录音' }));
        }, 300);
    }, [clearSilenceMonitor, isToggleRecordingMode]);

    // ===== Engine Event Listener =====
    useEffect(() => {
        setState(prev => ({ ...prev, isElectron }));
        if (!isElectron) return;

        setState(prev => ({
            ...prev,
            statusMessage: prev.engineRunning ? prev.statusMessage : '正在初始化引擎...',
        }));

        const api = window.electronAPI!;

        api.onEngineEvent((data) => {
            switch (data.event) {
                case 'ready':
                    setState(prev => ({ ...prev, engineRunning: true, statusMessage: '引擎就绪，可开始录音' }));
                    // Sync engine's loaded config (from engine_config.json) back to localStorage
                    if (data.config) {
                        const engineCfg = data.config as Record<string, unknown>;
                        const patch: Record<string, unknown> = {};
                        if (engineCfg.llm_backend) patch.llmBackend = engineCfg.llm_backend;
                        if (engineCfg.llm_api_url) patch.llmApiUrl = engineCfg.llm_api_url;
                        if (engineCfg.llm_api_key) patch.llmApiKey = engineCfg.llm_api_key;
                        if (engineCfg.llm_api_model) patch.llmApiModel = engineCfg.llm_api_model;
                        if (engineCfg.llm_local_model) patch.llmLocalModel = engineCfg.llm_local_model;
                        if (engineCfg.asr_backend) patch.asrBackend = engineCfg.asr_backend;
                        if (engineCfg.asr_local_model) patch.asrLocalModel = engineCfg.asr_local_model;
                        if ('asr_local_model_path' in engineCfg) patch.asrLocalModelPath = String(engineCfg.asr_local_model_path || '');
                        if (engineCfg.asr_api_url) patch.asrApiUrl = engineCfg.asr_api_url;
                        if (engineCfg.asr_api_key) patch.asrApiKey = engineCfg.asr_api_key;
                        if (engineCfg.asr_api_model) patch.asrApiModel = engineCfg.asr_api_model;
                        if (Object.keys(patch).length > 0) updateConfig(patch as never);
                        setState(prev => ({
                            ...prev,
                            llmAvailable: inferLlmAvailableFromConfig(engineCfg),
                            llmAvailabilityKnown: true,
                            asrInstallRequired: String(engineCfg.asr_backend || '').toLowerCase() === 'api' ? false : prev.asrInstallRequired,
                        }));
                    }
                    break;
                case 'capabilities':
                    setState(prev => ({ ...prev, llmAvailable: !!data.llm_available, llmAvailabilityKnown: true }));
                    break;
                case 'config_updated':
                    if (data.config) {
                        const engineCfg = data.config as Record<string, unknown>;
                        if ('asr_local_model_path' in engineCfg) {
                            updateConfig({ asrLocalModelPath: String(engineCfg.asr_local_model_path || '') });
                        }
                        setState(prev => ({
                            ...prev,
                            llmAvailable: inferLlmAvailableFromConfig(engineCfg),
                            llmAvailabilityKnown: true,
                            asrInstallRequired: String(engineCfg.asr_backend || '').toLowerCase() === 'api' ? false : prev.asrInstallRequired,
                        }));
                    }
                    break;

                case 'download_progress': {
                    if (data.target !== 'asr') break;
                    const stage = String(data.stage || '');
                    const percent = Math.max(0, Math.min(100, Number(data.percent || 0)));
                    const active = stage === 'started' || stage === 'downloading';
                    const model = String(data.model || 'whisper');
                    const downloadedMB = Number(data.downloaded_mb || 0);
                    const totalMB = Number(data.total_mb || 0);
                    const speedMBps = Number(data.speed_mbps || 0);

                    setState(prev => ({
                        ...prev,
                        asrDownloadActive: active,
                        asrDownloadPercent: percent,
                        asrDownloadModel: model,
                        asrDownloadDownloadedMB: downloadedMB,
                        asrDownloadTotalMB: totalMB,
                        asrDownloadSpeedMBps: speedMBps,
                        asrPreparingModel: active ? model : (stage === 'completed' ? '' : prev.asrPreparingModel),
                        statusMessage: active
                            ? `正在下载 ${model} 模型... ${percent}%`
                            : prev.statusMessage,
                    }));
                    break;
                }

                case 'asr_install_required': {
                    const options = Array.isArray(data.options)
                        ? data.options.map(v => String(v)).filter(Boolean)
                        : ['whisper-tiny', 'whisper-base', 'whisper-small'];
                    setState(prev => ({
                        ...prev,
                        asrInstallRequired: true,
                        asrInstallOptions: options,
                        asrPreparingModel: '',
                        asrDownloadActive: false,
                        asrDownloadPercent: 0,
                        statusMessage: data.message || '未检测到本地 ASR 模型，请先安装',
                    }));
                    break;
                }

                case 'asr_model_prepared': {
                    const model = String(data.model || '');
                    setState(prev => ({
                        ...prev,
                        asrInstallRequired: false,
                        asrPreparingModel: '',
                        asrDownloadActive: false,
                        asrDownloadPercent: 100,
                        asrDownloadModel: model || prev.asrDownloadModel,
                        statusMessage: model ? `${model} 安装完成，可开始录音` : 'ASR 模型安装完成，可开始录音',
                    }));
                    break;
                }

                case 'recording_started':
                    recordingStartTime.current = Date.now();
                    pendingStartRef.current = false;
                    activeRecordingModeRef.current = data.mode || 'normal';
                    setState(prev => ({
                        ...prev,
                        isRecording: true,
                        isProcessing: false,
                        statusMessage: data.mode === 'translate' ? '翻译中...' : '正在录音...',
                        error: ''
                    }));
                    isTogglingRef.current = false;
                    window.electronAPI?.updateOverlay?.({
                        visible: true,
                        status: 'recording',
                        text: data.mode === 'translate' ? '翻译中...' : '正在录音...'
                    });
                    startSilenceMonitor(activeRecordingModeRef.current);
                    break;

                case 'recording_stopped':
                    pendingStartRef.current = false;
                    clearSilenceMonitor();
                    setState(prev => ({ ...prev, isRecording: false, isProcessing: true, statusMessage: '正在识别...' }));
                    isTogglingRef.current = false;
                    window.electronAPI?.updateOverlay?.({
                        visible: true,
                        status: 'processing',
                        text: '正在处理...'
                    });
                    break;

                case 'transcription':
                    if (data.is_silent) {
                        addHistoryItem({
                            time: new Date().toISOString(),
                            text: '音频无声。',
                            wordCount: 0,
                            isInfo: true,
                        });
                        // Silence is a terminal state for ASR
                        setState(prev => ({ ...prev, isProcessing: false, statusMessage: '' }));
                    } else {
                        setState(prev => ({
                            ...prev,
                            lastTranscription: data.text || '',
                            statusMessage: '正在润色...',
                        }));
                    }
                    break;

                case 'polished':
                    setState(prev => ({ ...prev, lastPolished: data.text || '' }));
                    break;

                case 'finished': {
                    const text = data.text || '';
                    if (text) {
                        const durationSec = (Date.now() - recordingStartTime.current) / 1000;
                        // Strip punctuation and whitespace to get a more accurate character/word count
                        const cleanText = text.replace(/[.,!?;:'"()[\]{}\s]/g, '');
                        const finalWordCount = cleanText.length || 1;
                        addHistoryItem({
                            time: new Date().toISOString(),
                            text,
                            wordCount: finalWordCount,
                            duration: durationSec,
                        });
                        setState(prev => ({ ...prev, lastWordCount: finalWordCount }));
                    }
                    // This is the definitive end of a cycle
                    clearSilenceMonitor();
                    setState(prev => ({ ...prev, isProcessing: false, statusMessage: '' }));
                    window.electronAPI?.updateOverlay?.({ visible: false, status: 'finished', text: '处理完毕' });
                    break;
                }

                case 'audio_level': {
                    const level = Number(data.level || 0);
                    if (level > AUDIO_ACTIVE_THRESHOLD) {
                        lastAudioActivityAtRef.current = Date.now();
                    }
                    break;
                }

                case 'typed':
                    break;

                case 'status':
                    setState(prev => ({ ...prev, statusMessage: data.message || '' }));
                    break;

                case 'error':
                    pendingStartRef.current = false;
                    clearSilenceMonitor();
                    setState(prev => ({
                        ...prev,
                        isRecording: false,
                        isProcessing: false,
                        asrDownloadActive: false,
                        asrPreparingModel: '',
                        error: data.message || '未知错误',
                        statusMessage: ''
                    }));
                    window.electronAPI?.updateOverlay?.({ visible: false, status: 'finished', text: '' });
                    isTogglingRef.current = false;
                    setTimeout(() => setState(prev => ({ ...prev, error: '' })), 5000);
                    break;

                case 'pong':
                    setState(prev => ({ ...prev, engineRunning: true }));
                    break;
            }
        });

        // Check engine status
        api.getEngineStatus().then(status => {
            setState(prev => ({ ...prev, engineRunning: status.running }));
        });
        // Pull config once after listener is attached to avoid missing early startup events.
        api.sendCommand({ cmd: 'get_config' });

        return () => {
            clearSilenceMonitor();
            api.removeAllListeners('engine-event');
        };
    }, [clearSilenceMonitor, startSilenceMonitor]);

    // ===== Hotkey Handler =====
    useEffect(() => {
        if (!isElectron) return;
        const api = window.electronAPI!;

        // Sync initial hotkeys to main process on startup
        const cfg = getConfig();
        if (api.updateHotkeys) {
            api.updateHotkeys({
                voiceInput: cfg.voiceInputHotkey || cfg.hotkey || 'F2',
                handsfree: cfg.handsfreeHotkey || 'Space',
                translate: cfg.translateHotkey || 'Alt+T',
                holdToRecord: !!cfg.holdToRecord,
                blockInput: cfg.blockInput !== false,
            });
        }

        api.onHotkeyEvent((data: { key: string; mode: string; type: 'keydown' | 'keyup' }) => {
            const { mode, type } = data;
            const cfgNow = getConfig();
            const holdToRecord = !!cfgNow.holdToRecord;
            const isHoldMode = mode === 'voiceInput' ? holdToRecord : mode === 'translate' ? holdToRecord : false;

            const clearHoldStopTimer = (m: string) => {
                const timerId = holdStopTimersRef.current[m];
                if (timerId) {
                    window.clearTimeout(timerId);
                    delete holdStopTimersRef.current[m];
                }
            };

            const refreshHoldStopTimer = (m: string) => {
                clearHoldStopTimer(m);
                // Fallback: if keyup is missed, stop after heartbeat disappears.
                holdStopTimersRef.current[m] = window.setTimeout(() => {
                    stopRecording(true);
                    clearHoldStopTimer(m);
                }, 800);
            };

            if (mode === 'handsfree') {
                if (type === 'keydown') toggleRecording('handsfree');
                return;
            }

            if (mode === 'translate') {
                if (stateRef.current.llmAvailabilityKnown && !stateRef.current.llmAvailable) {
                    setState(prev => ({
                        ...prev,
                        error: '翻译模式不可用：请先配置 LLM（本地 Ollama 或 API）',
                        statusMessage: '仅语音识别可用',
                    }));
                    setTimeout(() => setState(prev => ({ ...prev, error: '' })), 4000);
                    return;
                }
                if (holdToRecord) {
                    if (type === 'keydown') {
                        startRecording('translate');
                        refreshHoldStopTimer(mode);
                    } else {
                        clearHoldStopTimer(mode);
                        stopRecording(true);
                    }
                } else if (type === 'keydown') {
                    toggleRecording('translate');
                }
                return;
            }

            if (holdToRecord) {
                if (type === 'keydown') {
                    startRecording('normal');
                    refreshHoldStopTimer(mode);
                } else {
                    clearHoldStopTimer(mode);
                    stopRecording(true);
                }
            } else if (type === 'keydown') {
                toggleRecording('normal');
            }

            if (!isHoldMode) {
                clearHoldStopTimer(mode);
            }
        });

        return () => {
            for (const timerId of Object.values(holdStopTimersRef.current) as number[]) {
                window.clearTimeout(timerId);
            }
            holdStopTimersRef.current = {};
            clearSilenceMonitor();
            api.removeAllListeners('hotkey-event');
        };
    }, [isElectron, clearSilenceMonitor]);

    // ===== Actions =====

    const toggleRecording = useCallback((mode = 'normal') => {
        if (isTogglingRef.current) return;
        const cur = stateRef.current;
        if (cur.isProcessing || (isElectron && !cur.engineRunning)) return;
        if (cur.asrInstallRequired) {
            setState(prev => ({
                ...prev,
                error: '本地 ASR 模型尚未安装，请先在设置中安装 tiny/base/small 模型',
                statusMessage: '请先安装本地 ASR 模型',
            }));
            setTimeout(() => setState(prev => ({ ...prev, error: '' })), 4500);
            return;
        }
        if (mode === 'translate' && cur.llmAvailabilityKnown && !cur.llmAvailable) {
            setState(prev => ({
                ...prev,
                error: '翻译模式不可用：请先配置 LLM（本地 Ollama 或 API）',
                statusMessage: '仅语音识别可用',
            }));
            setTimeout(() => setState(prev => ({ ...prev, error: '' })), 4000);
            return;
        }

        isTogglingRef.current = true;
        setTimeout(() => { isTogglingRef.current = false; }, 500);

        if (!isElectron) {
            setState(prev => {
                if (prev.isRecording) {
                    return { ...prev, isRecording: false, isProcessing: true, statusMessage: '正在处理...' };
                }
                return { ...prev, isRecording: true, statusMessage: '正在录音...' };
            });
            return;
        }

        const api = window.electronAPI!;
        if (cur.isRecording) {
            api.sendCommand({ cmd: 'stop_recording' });
        } else {
            pendingStartRef.current = true;
            api.sendCommand({ cmd: 'start_recording', mode });
        }
    }, [isElectron]);

    const startRecording = useCallback((mode = 'normal') => {
        if (stateRef.current.isRecording || pendingStartRef.current || stateRef.current.isProcessing || (isElectron && !stateRef.current.engineRunning)) return;
        if (stateRef.current.asrInstallRequired) return;
        if (mode === 'translate' && stateRef.current.llmAvailabilityKnown && !stateRef.current.llmAvailable) return;
        if (isElectron) {
            pendingStartRef.current = true;
            window.electronAPI!.sendCommand({ cmd: 'start_recording', mode });
        }
    }, [isElectron]);

    const stopRecording = useCallback((force = false) => {
        const shouldStop = force || stateRef.current.isRecording || pendingStartRef.current;
        if (!shouldStop) return;
        pendingStartRef.current = false;
        if (isElectron) {
            window.electronAPI!.sendCommand({ cmd: 'stop_recording' });
        }
    }, [isElectron]);

    const installAsrModel = useCallback((model: string) => {
        if (!isElectron || !window.electronAPI?.sendCommand) return;
        const normalized = String(model || '').trim() || 'whisper-base';
        updateConfig({ asrLocalModel: normalized });
        setState(prev => ({
            ...prev,
            asrPreparingModel: normalized,
            asrDownloadActive: true,
            asrDownloadPercent: 0,
            asrDownloadModel: normalized,
            statusMessage: `开始安装 ${normalized}...`,
            error: '',
        }));
        window.electronAPI.sendCommand({
            cmd: 'set_config',
            config: {
                asr_backend: 'local',
                asr_local_model: normalized,
            },
        });
        window.electronAPI.sendCommand({ cmd: 'prepare_asr_model', model: normalized });
    }, [isElectron]);

    // Called from SettingsPage when user changes hotkeys
    const updateHotkeys = useCallback((keys: Record<string, string | boolean>) => {
        if (isElectron && window.electronAPI!.updateHotkeys) {
            window.electronAPI!.updateHotkeys(keys);
        }
    }, [isElectron]);

    return {
        ...state,
        toggleRecording,
        startRecording,
        stopRecording,
        installAsrModel,
        updateHotkeys,
    };
}
