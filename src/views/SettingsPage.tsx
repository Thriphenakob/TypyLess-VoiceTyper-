import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import { Keyboard, Mic, Headphones, Languages, Globe, MicIcon, Volume2, VolumeX, Power, BarChart2, RotateCcw, Info, ChevronDown, Cpu, Cloud } from 'lucide-react';
import { getConfig, updateConfig, getTotalStats, type AppConfig } from '../lib/storage';

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        </label>
    );
}

import { HotkeyButton } from '../components/HotkeyButton';

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
            <div className="relative">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="appearance-none bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 py-2 pl-4 pr-10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
                >
                    {options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-2.5 text-gray-400 dark:text-gray-500 pointer-events-none" />
            </div>
        </div>
    );
}

export default function SettingsPage() {
    const [config, setConfig] = useState<AppConfig>(getConfig());
    const [stats, setStats] = useState<ReturnType<typeof getTotalStats> | null>(null);

    useEffect(() => {
        setStats(getTotalStats());
    }, []);

    const update = (patch: Partial<AppConfig>) => {
        const updated = updateConfig(patch);
        setConfig(updated);
        // Sync hotkey changes to Electron main process
        if (
            patch.hotkey !== undefined ||
            patch.voiceInputHotkey !== undefined ||
            patch.handsfreeHotkey !== undefined ||
            patch.translateHotkey !== undefined ||
            patch.holdToRecord !== undefined ||
            patch.blockInput !== undefined
        ) {
            if (window.electronAPI?.updateHotkeys) {
                window.electronAPI.updateHotkeys({
                    voiceInput: updated.voiceInputHotkey || updated.hotkey || 'F2',
                    handsfree: updated.handsfreeHotkey || 'Space',
                    translate: updated.translateHotkey || 'Alt+T',
                    holdToRecord: !!updated.holdToRecord,
                    blockInput: updated.blockInput !== false,
                });
            }
        }

        // Sync AI engine config to Python backend
        const engineKeys = ['asrBackend', 'asrLocalModel', 'asrApiUrl', 'asrApiKey', 'asrApiModel',
            'llmBackend', 'llmLocalModel', 'llmApiUrl', 'llmApiKey', 'llmApiModel',
            'polishEnabled'];
        if (engineKeys.some(k => k in patch)) {
            if (window.electronAPI?.sendCommand) {
                window.electronAPI.sendCommand({
                    cmd: 'set_config',
                    config: {
                        asr_backend: updated.asrBackend,
                        asr_local_model: updated.asrLocalModel,
                        asr_api_url: updated.asrApiUrl,
                        asr_api_key: updated.asrApiKey,
                        asr_api_model: updated.asrApiModel,
                        llm_backend: updated.llmBackend,
                        llm_local_model: updated.llmLocalModel,
                        llm_api_url: updated.llmApiUrl,
                        llm_api_key: updated.llmApiKey,
                        llm_api_model: updated.llmApiModel,
                        polish_enabled: updated.polishEnabled
                    }
                });
            }
        }
    };

    const handleResetStats = () => {
        if (window.confirm('确定要重置所有统计数据吗？此操作无法撤销。')) {
            localStorage.removeItem('voicetyper_daily_stats');
            setStats(getTotalStats());
        }
    };

    return (
        <div className="flex flex-col h-full">
            <Header title="设置" />
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-3xl mx-auto space-y-8">

                    {/* Keyboard Shortcuts */}
                    <section className="bg-gray-50 dark:bg-[#13151a] rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-2 mb-6">
                            <Keyboard size={20} className="text-blue-600 dark:text-blue-400" />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">键盘快捷键</h2>
                        </div>

                        <div className="space-y-6">
                            {/* Voice Input */}
                            <div className="bg-white dark:bg-gray-900/50 rounded-xl p-5 space-y-3 border border-gray-100 dark:border-gray-800">
                                <div className="flex items-center gap-2">
                                    <Mic size={16} className="text-blue-600 dark:text-blue-400" />
                                    <h3 className="text-gray-900 dark:text-white font-medium">语音输入</h3>
                                </div>
                                <p className="text-xs text-gray-500 leading-relaxed">按住说话，松开后文字自动输入到光标位置。或双击进入免提模式。</p>
                                <HotkeyButton label="热键" value={config.voiceInputHotkey} onChange={(v) => update({ voiceInputHotkey: v, hotkey: v })} />
                            </div>

                            {/* Hands-free Mode */}
                            <div className="bg-white dark:bg-gray-900/50 rounded-xl p-5 space-y-3 border border-gray-100 dark:border-gray-800">
                                <div className="flex items-center gap-2">
                                    <Headphones size={16} className="text-green-600 dark:text-green-400" />
                                    <h3 className="text-gray-900 dark:text-white font-medium">免提模式</h3>
                                </div>
                                <p className="text-xs text-gray-500 leading-relaxed">按一次开始录音，再按一次停止并粘贴文本。</p>
                                <HotkeyButton label="热键" value={config.handsfreeHotkey} onChange={(v) => update({ handsfreeHotkey: v })} />
                            </div>

                            {/* Translate Mode */}
                            <div className="bg-white dark:bg-gray-900/50 rounded-xl p-5 space-y-3 border border-gray-100 dark:border-gray-800">
                                <div className="flex items-center gap-2">
                                    <Languages size={16} className="text-purple-600 dark:text-purple-400" />
                                    <h3 className="text-gray-900 dark:text-white font-medium">翻译模式</h3>
                                </div>
                                <p className="text-xs text-gray-500 leading-relaxed">按下后说话，松开后翻译至目标语言并输入。</p>
                                <HotkeyButton label="热键" value={config.translateHotkey} onChange={(v) => update({ translateHotkey: v })} />
                            </div>

                            <div className="flex justify-end">
                                <button
                                    onClick={() => update({ voiceInputHotkey: 'F2', handsfreeHotkey: 'Space', translateHotkey: 'Alt+T' })}
                                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex items-center gap-1"
                                >
                                    <RotateCcw size={12} /> 恢复默认热键
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Language */}
                    <section className="bg-gray-50 dark:bg-[#13151a] rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-2 mb-6">
                            <Globe size={20} className="text-green-600 dark:text-green-400" />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">语言</h2>
                        </div>

                        <div className="space-y-5">
                            <SelectField
                                label="界面语言"
                                value={config.interfaceLang}
                                onChange={(v) => update({ interfaceLang: v })}
                                options={[
                                    { value: 'zh-CN', label: '简体中文（中国大陆）' },
                                    { value: 'zh-TW', label: '繁體中文（台灣）' },
                                    { value: 'en', label: 'English' },
                                    { value: 'ja', label: '日本語' },
                                    { value: 'ko', label: '한국어' },
                                ]}
                            />
                            <SelectField
                                label="翻译目标"
                                value={config.translateTarget}
                                onChange={(v) => update({ translateTarget: v })}
                                options={[
                                    { value: 'en', label: 'English' },
                                    { value: 'zh', label: '中文' },
                                    { value: 'ja', label: '日本語' },
                                    { value: 'ko', label: '한국어' },
                                    { value: 'fr', label: 'Français' },
                                    { value: 'de', label: 'Deutsch' },
                                ]}
                            />
                            <SelectField
                                label="语言变体"
                                value={config.langVariant}
                                onChange={(v) => update({ langVariant: v })}
                                options={[
                                    { value: 'en-US', label: '美式英语' },
                                    { value: 'en-GB', label: '英式英语' },
                                    { value: 'en-AU', label: '澳式英语' },
                                ]}
                            />
                        </div>
                    </section>

                    {/* Audio */}
                    <section className="bg-gray-50 dark:bg-[#13151a] rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-2 mb-6">
                            <MicIcon size={20} className="text-orange-600 dark:text-orange-400" />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">音频设置</h2>
                        </div>

                        <div className="space-y-5">
                            <SelectField
                                label="麦克风"
                                value={config.microphone}
                                onChange={(v) => update({ microphone: v })}
                                options={[
                                    { value: 'default', label: '系统默认' },
                                    { value: 'built-in', label: '内置麦克风' },
                                ]}
                            />
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Volume2 size={16} className="text-gray-400" />
                                    <div>
                                        <span className="text-sm text-gray-700 dark:text-gray-300">交互声音</span>
                                        <p className="text-xs text-gray-500">开始/停止录音时播放提示音</p>
                                    </div>
                                </div>
                                <Toggle checked={config.soundFeedback} onChange={(v) => update({ soundFeedback: v })} />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <VolumeX size={16} className="text-gray-400" />
                                    <div>
                                        <span className="text-sm text-gray-700 dark:text-gray-300">语音输入时静音</span>
                                        <p className="text-xs text-gray-500">录音期间自动降低其他应用音量</p>
                                    </div>
                                </div>
                                <Toggle checked={config.muteOnRecord} onChange={(v) => update({ muteOnRecord: v })} />
                            </div>
                        </div>
                    </section>

                    {/* AI Engine */}
                    <section className="bg-gray-50 dark:bg-[#13151a] rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-2 mb-6">
                            <Cpu size={20} className="text-violet-600 dark:text-violet-400" />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">AI 引擎</h2>
                        </div>

                        <div className="space-y-6">
                            {/* ASR Backend */}
                            <div className="bg-white dark:bg-gray-900/50 rounded-xl p-5 space-y-4 border border-gray-100 dark:border-gray-800">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Mic size={16} className="text-blue-500" />
                                        <h3 className="text-gray-900 dark:text-white font-medium">语音识别 (ASR)</h3>
                                    </div>
                                    <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                                        <button onClick={() => update({ asrBackend: 'local' })} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${config.asrBackend === 'local' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                                            <Cpu size={12} className="inline mr-1" />本地
                                        </button>
                                        <button onClick={() => update({ asrBackend: 'api' })} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${config.asrBackend === 'api' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                                            <Cloud size={12} className="inline mr-1" />API
                                        </button>
                                    </div>
                                </div>
                                {config.asrBackend === 'local' ? (
                                    <div className="space-y-2">
                                        <p className="text-xs text-gray-500">本地模型离线识别。首次使用对应模型时会自动下载。</p>
                                        <SelectField
                                            label="本地模型"
                                            value={config.asrLocalModel}
                                            onChange={(v) => update({ asrLocalModel: v })}
                                            options={[
                                                { value: 'whisper-tiny', label: 'Whisper Tiny（最快）' },
                                                { value: 'whisper-base', label: 'Whisper Base（默认推荐）' },
                                                { value: 'whisper-small', label: 'Whisper Small（更准）' },
                                            ]}
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs text-gray-500 mb-1 block">API 地址</label>
                                            <input type="text" value={config.asrApiUrl} onChange={(e) => update({ asrApiUrl: e.target.value })} placeholder="https://api.openai.com/v1/audio/transcriptions" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 mb-1 block">API Key</label>
                                            <input type="password" value={config.asrApiKey} onChange={(e) => update({ asrApiKey: e.target.value })} placeholder="sk-..." className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 mb-1 block">模型名称</label>
                                            <input type="text" value={config.asrApiModel} onChange={(e) => update({ asrApiModel: e.target.value })} placeholder="whisper-1" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:outline-none" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* LLM Backend */}
                            <div className="bg-white dark:bg-gray-900/50 rounded-xl p-5 space-y-4 border border-gray-100 dark:border-gray-800">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Languages size={16} className="text-green-500" />
                                        <h3 className="text-gray-900 dark:text-white font-medium">文字润色 (LLM)</h3>
                                    </div>
                                    <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                                        <button onClick={() => update({ llmBackend: 'local' })} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${config.llmBackend === 'local' ? 'bg-green-600 text-white shadow' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                                            <Cpu size={12} className="inline mr-1" />本地
                                        </button>
                                        <button onClick={() => update({ llmBackend: 'api' })} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${config.llmBackend === 'api' ? 'bg-green-600 text-white shadow' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                                            <Cloud size={12} className="inline mr-1" />API
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                        <div>
                                            <span className="text-sm text-gray-700 dark:text-gray-300">自动润色 (Auto Polish)</span>
                                            <p className="text-xs text-gray-500">开启后将使用 LLM 修正语法去口语化。关闭则输出原始识别文本。</p>
                                        </div>
                                    </div>
                                    <Toggle checked={config.polishEnabled !== false} onChange={(v) => update({ polishEnabled: v })} />
                                </div>

                                {config.llmBackend === 'local' ? (
                                    <div className="space-y-2">
                                        <p className="text-xs text-gray-500">通过 Ollama 运行本地模型</p>
                                        <SelectField label="模型" value={config.llmLocalModel} onChange={(v) => update({ llmLocalModel: v })} options={[
                                            { value: 'qwen3.5:4b', label: 'Qwen 3.5 4B（推荐）' },
                                            { value: 'qwen3.5:2b', label: 'Qwen 3.5 2B（更快）' },
                                            { value: 'qwen3.5:9b', label: 'Qwen 3.5 9B（更强）' },
                                            { value: 'qwen2.5:3b', label: 'Qwen 2.5 3B' },
                                            { value: 'deepseek-r1:7b', label: 'DeepSeek R1 7B' },
                                        ]} />
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex gap-2 flex-wrap">
                                            <button onClick={() => update({ llmApiUrl: 'https://api.deepseek.com/v1/chat/completions', llmApiModel: 'deepseek-chat' })} className="text-xs px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">DeepSeek</button>
                                            <button onClick={() => update({ llmApiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', llmApiModel: 'qwen-plus' })} className="text-xs px-2.5 py-1 rounded-md bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors">通义千问</button>
                                            <button onClick={() => update({ llmApiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', llmApiModel: 'glm-4-flash' })} className="text-xs px-2.5 py-1 rounded-md bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors">智谱 GLM</button>
                                            <button onClick={() => update({ llmApiUrl: 'https://api.openai.com/v1/chat/completions', llmApiModel: 'gpt-4o-mini' })} className="text-xs px-2.5 py-1 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">OpenAI</button>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 mb-1 block">API 地址</label>
                                            <input type="text" value={config.llmApiUrl} onChange={(e) => update({ llmApiUrl: e.target.value })} placeholder="https://api.deepseek.com/v1/chat/completions" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-green-500/50 focus:outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 mb-1 block">API Key</label>
                                            <input type="password" value={config.llmApiKey} onChange={(e) => update({ llmApiKey: e.target.value })} placeholder="sk-..." className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-green-500/50 focus:outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 mb-1 block">模型名称</label>
                                            <input type="text" value={config.llmApiModel} onChange={(e) => update({ llmApiModel: e.target.value })} placeholder="deepseek-chat" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-green-500/50 focus:outline-none" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* App Behavior */}
                    <section className="bg-gray-50 dark:bg-[#13151a] rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-2 mb-6">
                            <Power size={20} className="text-red-600 dark:text-red-400" />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">应用行为</h2>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-sm text-gray-700 dark:text-gray-300">登录时启动应用</span>
                                <p className="text-xs text-gray-500">系统开机时自动后台启动</p>
                            </div>
                            <Toggle checked={config.startOnBoot} onChange={(v) => update({ startOnBoot: v })} />
                        </div>
                    </section>

                    {/* Stats Management */}
                    {stats && (
                        <section className="bg-gray-50 dark:bg-[#13151a] rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-2 mb-6">
                                <BarChart2 size={20} className="text-blue-600 dark:text-blue-400" />
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">统计管理</h2>
                            </div>

                            <div className="flex items-center justify-between mb-6">
                                <div className="grid grid-cols-2 gap-8">
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalWords.toLocaleString()} 字</p>
                                        <p className="text-xs text-gray-500">累计输入字数</p>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalDays} 天</p>
                                        <p className="text-xs text-gray-500">累计使用天数</p>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleResetStats}
                                className="text-sm text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors border border-red-200 dark:border-red-800/50 hover:border-red-400 dark:hover:border-red-700 px-4 py-2 rounded-lg flex items-center gap-2"
                            >
                                <RotateCcw size={14} /> 重置统计
                            </button>
                        </section>
                    )}

                    {/* About */}
                    <section className="bg-gray-50 dark:bg-[#13151a] rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-2 mb-4">
                            <Info size={20} className="text-gray-400" />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">关于</h2>
                        </div>
                        <div className="space-y-2 text-sm text-gray-500">
                            <p>VoiceTyper v0.1.0</p>
                            <p>由 Thriphen 开发</p>
                            <p>基于 Whisper + Qwen 构建</p>
                        </div>
                    </section>

                </div>
            </div>
        </div>
    );
}
