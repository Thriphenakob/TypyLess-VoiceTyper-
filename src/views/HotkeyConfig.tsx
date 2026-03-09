import React, { useState } from 'react';
import Header from '../components/Header';
import { Command, Edit2, Volume2, Timer, Ban, Info, RotateCcw } from 'lucide-react';
import { getConfig, updateConfig, type AppConfig } from '../lib/storage';
import { HotkeyButton } from '../components/HotkeyButton';

export default function HotkeyConfig() {
  const [config, setConfig] = useState<AppConfig>(getConfig());

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
  };

  const currentHotkey = config.voiceInputHotkey || config.hotkey || 'F2';

  return (
    <div className="flex flex-col h-full">
      <Header title="热键配置" />
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto space-y-8">

          <section className="bg-gray-50 dark:bg-[#13151a] rounded-2xl p-8 border border-gray-100 dark:border-gray-800">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold text-lg">
                  <Command className="text-blue-600" size={24} />
                  <h2>激活热键</h2>
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md leading-relaxed">
                  此按键组合用于唤醒主语音录制功能。你还可以去“设置”中配置免提模式和翻译模式专属热键。
                </p>
                <div className="max-w-[250px] mt-4">
                  <HotkeyButton label="主录音热键" value={currentHotkey} onChange={(v) => update({ voiceInputHotkey: v, hotkey: v })} />
                </div>
              </div>
              <div className="flex flex-col items-center gap-3 bg-white dark:bg-[#1c1f26] p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm min-w-[200px]">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">当前唤醒键</span>
                <div className="flex items-center justify-center px-6 py-3 bg-gray-100 dark:bg-gray-800 rounded-lg border-b-4 border-gray-300 dark:border-gray-600 active:border-b-0 active:mt-1 transition-all">
                  <span className="text-3xl font-mono font-bold text-gray-800 dark:text-gray-100 tracking-wider">
                    {currentHotkey}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-4">
              <button
                onClick={() => update({ voiceInputHotkey: 'F2', hotkey: 'F2' })}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm font-medium px-4 py-2 transition-colors flex items-center gap-1"
              >
                <RotateCcw size={14} /> 恢复默认
              </button>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 px-1">行为设置</h3>
            <div className="bg-white dark:bg-[#13151a] rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 shadow-sm">

              <div className="p-5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#1a1d23] transition-colors group">
                <div className="flex gap-4">
                  <div className="mt-1 text-gray-400 group-hover:text-blue-600 transition-colors">
                    <Volume2 size={20} />
                  </div>
                  <div>
                    <h4 className="text-gray-900 dark:text-white font-medium">声音反馈</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">录音开始和停止时播放独特的提示音。</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div
                className="p-5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#1a1d23] transition-colors group cursor-pointer"
                onClick={() => update({ holdToRecord: !config.holdToRecord })}
              >
                <div className="flex gap-4">
                  <div className="mt-1 text-gray-400 group-hover:text-blue-600 transition-colors">
                    <Timer size={20} />
                  </div>
                  <div>
                    <h4 className="text-gray-900 dark:text-white font-medium">按住录音模式</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">勾选后：长按热键录音，松开停止。取消勾选：按一次开始，再按一次停止。</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={config.holdToRecord || false}
                    onChange={(e) => update({ holdToRecord: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="p-5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#1a1d23] transition-colors group rounded-b-xl">
                <div className="flex gap-4">
                  <div className="mt-1 text-gray-400 group-hover:text-blue-600 transition-colors">
                    <Ban size={20} />
                  </div>
                  <div>
                    <h4 className="text-gray-900 dark:text-white font-medium">阻止输入</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">防止热键被发送到其他应用程序 (目前默认生效)。</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked disabled />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-400 peer-checked:bg-blue-400 cursor-not-allowed"></div>
                </label>
              </div>

            </div>
          </section>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-lg p-4 flex items-start gap-3">
            <Info className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" size={20} />
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>专业提示：</strong> 若无法绑定单纯的控制键 (如 Alt / Ctrl)，你需要按组合键 (如 Alt+Q)，或是使用原生功能键 (F1~F12)。
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
