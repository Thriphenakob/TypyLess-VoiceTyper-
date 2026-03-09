import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import { BarChart2, TrendingUp, Calendar, Clock, Activity, Hash } from 'lucide-react';
import { getTotalStats } from '../lib/storage';

const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1];
}

export default function Stats() {
  const [stats, setStats] = useState<ReturnType<typeof getTotalStats> | null>(null);

  useEffect(() => {
    setStats(getTotalStats());
  }, []);

  if (!stats) return null;

  const maxWords = Math.max(...stats.last7Days.map(d => d.wordCount), 1);

  return (
    <div className="flex flex-col h-full">
      <Header title="统计数据" subtitle="查看您的语音输入使用情况" />
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto space-y-8">

          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-[#18181b] p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">总输入字数</h3>
                <BarChart2 size={20} className="text-blue-500" />
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalWords.toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-2">今日 {stats.todayWords.toLocaleString()} 字</p>
            </div>

            <div className="bg-white dark:bg-[#18181b] p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">总听写时长</h3>
                <Clock size={20} className="text-purple-500" />
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{Math.floor(stats.totalMinutes / 60)}h {stats.totalMinutes % 60}m</p>
              <p className="text-sm text-gray-500 mt-2">今日 {stats.todayMinutes} 分钟</p>
            </div>

            <div className="bg-white dark:bg-[#18181b] p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">连续使用</h3>
                <Calendar size={20} className="text-orange-500" />
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.streak} 天</p>
              <p className="text-sm text-gray-500 mt-2">累计 {stats.totalDays} 天</p>
            </div>

            <div className="bg-white dark:bg-[#18181b] p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">使用次数</h3>
                <Hash size={20} className="text-green-500" />
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalSessions.toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-2">今日 {stats.todaySessions} 次</p>
            </div>
          </div>

          {/* Bar Chart - Last 7 Days */}
          <div className="bg-white dark:bg-[#18181b] p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">近 7 天输入量</h3>
            <div className="h-64 flex items-end justify-between gap-3">
              {stats.last7Days.map((day, i) => {
                const heightPct = maxWords > 0 ? (day.wordCount / maxWords) * 100 : 0;
                const isToday = i === stats.last7Days.length - 1;
                return (
                  <div key={day.date} className="w-full flex flex-col items-center gap-2">
                    <div
                      className={`w-full rounded-t-lg relative group transition-all cursor-pointer ${isToday
                          ? 'bg-blue-500 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-500'
                          : 'bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800/50'
                        }`}
                      style={{ height: `${Math.max(heightPct, 3)}%` }}
                    >
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none shadow-lg">
                        {day.wordCount.toLocaleString()} 字
                      </div>
                    </div>
                    <span className={`text-xs ${isToday ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                      {getDayLabel(day.date)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Session Stats */}
          <div className="bg-white dark:bg-[#18181b] p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">本次会话</h3>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.todayWords.toLocaleString()}</p>
                <p className="text-sm text-gray-500 mt-1">今日字数</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.todaySessions}</p>
                <p className="text-sm text-gray-500 mt-1">今日录音次数</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.todayMinutes}</p>
                <p className="text-sm text-gray-500 mt-1">今日分钟数</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
