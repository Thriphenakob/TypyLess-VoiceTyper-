import React from 'react';
import { Mic, Home, History, Keyboard, BarChart2, Settings, UserCircle, HelpCircle } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: string) => void }) {
  const navItems = [
    { id: 'home', icon: Home, label: '首页' },
    { id: 'history', icon: History, label: '历史记录' },
    { id: 'hotkey', icon: Keyboard, label: '热键设置' },
    { id: 'stats', icon: BarChart2, label: '统计数据' },
    { id: 'settings', icon: Settings, label: '设置' },
  ];

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col bg-[#F3F4F6] dark:bg-[#0f1115] border-r border-gray-200 dark:border-gray-800 transition-colors duration-200">
      <div className="p-6 flex items-center space-x-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/30">
          <Mic size={18} />
        </div>
        <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">VoiceTyper</span>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${isActive
                  ? 'bg-gray-200 dark:bg-gray-800 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
                }`}
            >
              <Icon size={18} className={`mr-3 ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Logo / Branding */}
      <div className="p-4 mt-auto">
        <div className="flex flex-col items-center justify-center text-center py-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md shadow-blue-500/20 mb-2">
            T
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">by Thriphen</span>
        </div>
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-gray-500 dark:text-gray-400">
        <button onClick={() => setActiveTab('profile')} className={`hover:text-gray-900 dark:hover:text-white transition-colors ${activeTab === 'profile' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
          <UserCircle size={20} />
        </button>
        <div className="flex space-x-3">
          <button onClick={() => window.open('https://github.com/thriphen', '_blank')} className="hover:text-gray-900 dark:hover:text-white transition-colors">
            <HelpCircle size={20} />
          </button>
        </div>
      </div>
    </aside>
  );
}
