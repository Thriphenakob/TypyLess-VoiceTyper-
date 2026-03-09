import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import { Mic, Clock, Keyboard, Settings, ArrowRight } from 'lucide-react';
import { getHistory, getTotalStats, type HistoryItem } from '../lib/storage';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function Home({
  onNavigate,
  onToggleRecording,
  isRecording = false,
  isProcessing = false,
  engineRunning = false,
  statusMessage = '',
  asrDownloadActive = false,
  asrDownloadPercent = 0,
  asrDownloadModel = '',
  asrDownloadDownloadedMB = 0,
  asrDownloadTotalMB = 0,
  asrDownloadSpeedMBps = 0,
}: {
  onNavigate?: (tab: string) => void;
  onToggleRecording?: () => void;
  isRecording?: boolean;
  isProcessing?: boolean;
  engineRunning?: boolean;
  statusMessage?: string;
  asrDownloadActive?: boolean;
  asrDownloadPercent?: number;
  asrDownloadModel?: string;
  asrDownloadDownloadedMB?: number;
  asrDownloadTotalMB?: number;
  asrDownloadSpeedMBps?: number;
}) {
  const [recentItems, setRecentItems] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState({ todayMinutes: 0, todayWords: 0 });

  useEffect(() => {
    const history = getHistory();
    setRecentItems(history.filter(h => !h.isInfo).slice(0, 3));
    const s = getTotalStats();
    setStats({ todayMinutes: s.todayMinutes, todayWords: s.todayWords });
  }, []);

  return (
    <div className="flex flex-col h-full">
      <Header title="首页" subtitle="欢迎使用 VoiceTyper" />
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto space-y-8">

          {/* Hero Section */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-400 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-2xl font-bold mb-2">准备好开始听写了吗？</h2>
              <p className="text-blue-100 mb-6 max-w-md">
                按下 F2 键或点击下方按钮，立即开始将您的语音转换为文字。
              </p>
              <button
                onClick={onToggleRecording}
                disabled={isProcessing || !engineRunning}
                className="bg-white text-blue-600 px-6 py-3 rounded-xl font-semibold shadow-sm hover:bg-blue-50 transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Mic size={20} />
                {!engineRunning ? '引擎初始化中...' : isProcessing ? '处理中...' : isRecording ? '停止录音' : '开始录音 (F2)'}
              </button>
              <p className="text-sm text-blue-50/90 mt-3">
                {statusMessage || (engineRunning ? '引擎就绪，可开始录音。' : '正在初始化引擎，请稍候。')}
              </p>
              {asrDownloadActive && (
                <div className="mt-3 max-w-md bg-white/15 border border-white/25 rounded-lg p-3">
                  <div className="flex items-center justify-between text-xs text-white/90 mb-1.5">
                    <span>下载 {asrDownloadModel || 'ASR 模型'}</span>
                    <span>{Math.round(asrDownloadPercent)}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/25 overflow-hidden">
                    <div
                      className="h-full bg-white transition-all duration-150"
                      style={{ width: `${Math.max(2, Math.min(100, asrDownloadPercent))}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-blue-50/95 mt-1.5">
                    {asrDownloadDownloadedMB.toFixed(1)}MB / {asrDownloadTotalMB > 0 ? `${asrDownloadTotalMB.toFixed(1)}MB` : '未知'} · {asrDownloadSpeedMBps.toFixed(2)} MB/s
                  </p>
                </div>
              )}
            </div>
            <Mic size={160} className="absolute -right-10 -bottom-10 text-white/10 rotate-12" />
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-50 dark:bg-[#18181b] p-6 rounded-xl border border-gray-100 dark:border-gray-800">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center mb-4">
                <Clock size={20} />
              </div>
              <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">今日听写时长</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.todayMinutes} 分钟</p>
            </div>
            <div className="bg-gray-50 dark:bg-[#18181b] p-6 rounded-xl border border-gray-100 dark:border-gray-800">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg flex items-center justify-center mb-4">
                <Keyboard size={20} />
              </div>
              <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">今日输入字数</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.todayWords.toLocaleString()} 字</p>
            </div>
            <div className="bg-gray-50 dark:bg-[#18181b] p-6 rounded-xl border border-gray-100 dark:border-gray-800">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg flex items-center justify-center mb-4">
                <Settings size={20} />
              </div>
              <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">当前模型</h3>
              <p className="text-lg font-bold text-gray-900 dark:text-white truncate">Whisper Base</p>
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">最近活动</h3>
              <button
                onClick={() => onNavigate?.('history')}
                className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline flex items-center gap-1"
              >
                查看全部 <ArrowRight size={16} />
              </button>
            </div>
            <div className="bg-white dark:bg-[#13151a] border border-gray-100 dark:border-gray-800 rounded-xl divide-y divide-gray-100 dark:divide-gray-800">
              {recentItems.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">暂无活动记录</div>
              ) : (
                recentItems.map((item) => (
                  <div key={item.id} className="p-4 flex items-start gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer">
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-12 flex-shrink-0">{formatTime(item.time)}</span>
                    <p className="text-sm text-gray-900 dark:text-gray-100 line-clamp-1">{item.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
