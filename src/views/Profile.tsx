import React, { useState, useEffect, useRef } from 'react';
import Header from '../components/Header';
import { Camera, Edit2, Calendar, Hash, Clock, BarChart2, Trophy } from 'lucide-react';
import { getProfile, updateProfile, getTotalStats, getAchievements, type UserProfile, type Achievement } from '../lib/storage';

export default function Profile() {
    const [profile, setProfile] = useState<UserProfile>(getProfile());
    const [stats, setStats] = useState<ReturnType<typeof getTotalStats> | null>(null);
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(profile.nickname);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setStats(getTotalStats());
        setAchievements(getAchievements());
    }, []);

    const handleSaveName = () => {
        const updated = updateProfile({ nickname: nameInput });
        setProfile(updated);
        setEditingName(false);
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const url = ev.target?.result as string;
            const updated = updateProfile({ avatarUrl: url });
            setProfile(updated);
        };
        reader.readAsDataURL(file);
    };

    const regDate = new Date(profile.registeredAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="flex flex-col h-full">
            <Header title="用户中心" />
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-3xl mx-auto space-y-8">

                    {/* Profile Card */}
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-8 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                        <div className="relative z-10 flex items-center gap-6">
                            <div className="relative group">
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center cursor-pointer overflow-hidden border-2 border-white/30 hover:border-white/60 transition-all"
                                >
                                    {profile.avatarUrl ? (
                                        <img src={profile.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-3xl font-bold">{profile.nickname.charAt(0).toUpperCase()}</span>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Camera size={20} />
                                    </div>
                                </div>
                                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                            </div>

                            <div className="flex-1">
                                {editingName ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            value={nameInput}
                                            onChange={(e) => setNameInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                                            className="bg-white/20 backdrop-blur-sm text-white text-xl font-bold px-3 py-1.5 rounded-lg border border-white/30 focus:outline-none focus:border-white/60 placeholder-white/50"
                                            autoFocus
                                        />
                                        <button onClick={handleSaveName} className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                                            保存
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-2xl font-bold">{profile.nickname}</h2>
                                        <button onClick={() => setEditingName(true)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                                            <Edit2 size={16} />
                                        </button>
                                    </div>
                                )}
                                <p className="text-blue-200 text-sm mt-1 flex items-center gap-1.5">
                                    <Calendar size={14} />
                                    注册于 {regDate}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Usage Stats */}
                    {stats && (
                        <div>
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 px-1">使用统计</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white dark:bg-[#18181b] p-5 rounded-xl border border-gray-100 dark:border-gray-800 text-center">
                                    <Calendar size={20} className="text-blue-500 mx-auto mb-3" />
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalDays}</p>
                                    <p className="text-xs text-gray-500 mt-1">累计使用天数</p>
                                </div>
                                <div className="bg-white dark:bg-[#18181b] p-5 rounded-xl border border-gray-100 dark:border-gray-800 text-center">
                                    <BarChart2 size={20} className="text-green-500 mx-auto mb-3" />
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalWords.toLocaleString()}</p>
                                    <p className="text-xs text-gray-500 mt-1">累计输入字数</p>
                                </div>
                                <div className="bg-white dark:bg-[#18181b] p-5 rounded-xl border border-gray-100 dark:border-gray-800 text-center">
                                    <Hash size={20} className="text-purple-500 mx-auto mb-3" />
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalSessions.toLocaleString()}</p>
                                    <p className="text-xs text-gray-500 mt-1">累计使用次数</p>
                                </div>
                                <div className="bg-white dark:bg-[#18181b] p-5 rounded-xl border border-gray-100 dark:border-gray-800 text-center">
                                    <Clock size={20} className="text-orange-500 mx-auto mb-3" />
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.todayWords.toLocaleString()}</p>
                                    <p className="text-xs text-gray-500 mt-1">今日已说字数</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Mini Bar Chart */}
                    {stats && (
                        <div className="bg-white dark:bg-[#18181b] p-6 rounded-xl border border-gray-100 dark:border-gray-800">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">每日趋势</h3>
                            <div className="h-32 flex items-end justify-between gap-2">
                                {stats.last7Days.map((day, i) => {
                                    const max = Math.max(...stats.last7Days.map(d => d.wordCount), 1);
                                    const pct = (day.wordCount / max) * 100;
                                    const isToday = i === stats.last7Days.length - 1;
                                    return (
                                        <div key={day.date} className="w-full flex flex-col items-center gap-1.5">
                                            <div
                                                className={`w-full rounded-t-md transition-all ${isToday ? 'bg-blue-500' : 'bg-blue-100 dark:bg-blue-900/30'}`}
                                                style={{ height: `${Math.max(pct, 4)}%` }}
                                            />
                                            <span className={`text-[10px] ${isToday ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-400'}`}>
                                                {new Date(day.date).toLocaleDateString('zh-CN', { weekday: 'narrow' })}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Achievements */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 px-1 flex items-center gap-2">
                            <Trophy size={16} />
                            成就徽章
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {achievements.map((a) => (
                                <div
                                    key={a.id}
                                    className={`p-5 rounded-xl border transition-all ${a.unlocked
                                            ? 'bg-white dark:bg-[#18181b] border-yellow-200 dark:border-yellow-800/50 shadow-sm'
                                            : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 opacity-50'
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <span className="text-3xl">{a.icon}</span>
                                        <div>
                                            <h4 className={`font-semibold ${a.unlocked ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                                                {a.title}
                                            </h4>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{a.description}</p>
                                        </div>
                                        {a.unlocked && (
                                            <span className="ml-auto text-yellow-500 text-sm font-semibold bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 rounded-full">
                                                已解锁
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
