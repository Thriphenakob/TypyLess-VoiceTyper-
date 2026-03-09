import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import { Save, Lock, Info, Copy, Trash2, ChevronDown } from 'lucide-react';
import { getHistory, clearHistory, type HistoryItem } from '../lib/storage';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function groupByDate(items: HistoryItem[]): Record<string, HistoryItem[]> {
  const groups: Record<string, HistoryItem[]> = {};
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  for (const item of items) {
    const d = new Date(item.time).toDateString();
    let label: string;
    if (d === today) label = '今天';
    else if (d === yesterday) label = '昨天';
    else label = new Date(item.time).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });

    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  }
  return groups;
}

export default function HistoryView() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleClearAll = () => {
    if (window.confirm('确定要清空所有历史记录吗？此操作无法撤销。')) {
      clearHistory();
      setHistory([]);
    }
  };

  const grouped = groupByDate(history);

  return (
    <div className="flex flex-col h-full">
      <Header title="历史记录" />
      <div className="flex-1 overflow-y-auto p-8 pt-4">
        <div className="max-w-4xl mx-auto">

          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 mb-8 border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Save size={18} className="text-gray-500 dark:text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-white">保存历史</span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 ml-7">您希望在设备上保存口述历史多久？</p>
              </div>
              <div className="relative">
                <select className="appearance-none bg-white dark:bg-[#1c1f26] border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white py-1.5 pl-4 pr-10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer shadow-sm">
                  <option>永远</option>
                  <option>30 天</option>
                  <option>1 年</option>
                </select>
                <ChevronDown size={16} className="absolute right-3 top-2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Lock size={18} className="text-gray-500 dark:text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-white">您的数据保持私密</span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 ml-7 leading-relaxed">
                  您的语音口述是私密的，零数据保留。它们仅存储在您的设备上，无法从其他地方访问。
                </p>
              </div>
              {history.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0 ml-4"
                >
                  <Trash2 size={14} />
                  清空
                </button>
              )}
            </div>
          </div>

          {history.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <p className="text-lg font-medium mb-1">暂无历史记录</p>
              <p className="text-sm">按下 F2 开始语音输入，记录将自动出现在此处。</p>
            </div>
          ) : (
            Object.entries(grouped).map(([dateLabel, items]) => (
              <div key={dateLabel} className="mb-6">
                <h3 className="text-sm text-gray-500 dark:text-gray-400 mb-3 font-medium">{dateLabel}</h3>
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-[#13151a]">
                  {items.map((item) => (
                    <div key={item.id} className="group flex items-start p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors relative">
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-16 flex-shrink-0 mt-0.5">
                        {formatTime(item.time)}
                      </span>

                      {item.isInfo ? (
                        <div className="flex-1 flex items-center text-gray-500 dark:text-gray-400 text-sm">
                          <span className="mr-2">{item.text}</span>
                          <Info size={16} className="text-gray-400" />
                        </div>
                      ) : (
                        <div className="flex-1 text-sm text-gray-900 dark:text-gray-100 leading-relaxed pr-24">
                          {item.text}
                        </div>
                      )}

                      {!item.isInfo && (
                        <div className="absolute right-4 top-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleCopy(item.text, item.id)}
                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                          >
                            {copied === item.id ? (
                              <span className="text-green-500 text-xs font-medium">已复制</span>
                            ) : (
                              <Copy size={16} />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}

        </div>
      </div>
    </div>
  );
}
