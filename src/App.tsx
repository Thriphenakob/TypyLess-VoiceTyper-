/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import HotkeyConfig from './views/HotkeyConfig';
import HistoryView from './views/History';
import Home from './views/Home';
import Stats from './views/Stats';
import Profile from './views/Profile';
import SettingsPage from './views/SettingsPage';
import Toasts from './components/Toasts';
import { Moon, Sun } from 'lucide-react';
import { initFirstLaunch } from './lib/storage';
import { useVoiceEngine } from './lib/useVoiceEngine';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [darkMode, setDarkMode] = useState(true);

  const engine = useVoiceEngine();

  // Seed demo data on first launch
  useEffect(() => {
    initFirstLaunch();
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Browser fallback: F2 key handling (when not in Electron)
  useEffect(() => {
    if (engine.isElectron) return; // Electron handles this via globalShortcut

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        engine.toggleRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [engine.isElectron, engine.toggleRecording]);

  return (
    <div className="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 h-screen flex overflow-hidden font-sans transition-colors duration-200">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-white dark:bg-[#1c1f26] sm:rounded-tl-2xl shadow-2xl relative z-10 transition-colors duration-200">
        {activeTab === 'home' && (
          <Home
            onNavigate={setActiveTab}
            onToggleRecording={() => engine.toggleRecording('normal')}
            isRecording={engine.isRecording}
            isProcessing={engine.isProcessing}
            engineRunning={engine.engineRunning}
            statusMessage={engine.statusMessage}
          />
        )}
        {activeTab === 'stats' && <Stats />}
        {activeTab === 'hotkey' && <HotkeyConfig />}
        {activeTab === 'history' && <HistoryView />}
        {activeTab === 'profile' && <Profile />}
        {activeTab === 'settings' && <SettingsPage />}
      </main>

      <Toasts
        isRecording={engine.isRecording}
        isProcessing={engine.isProcessing}
        showSuccess={!!engine.lastPolished}
        wordCount={engine.lastWordCount}
        statusMessage={engine.statusMessage}
      />



      {/* Error Toast */}
      {engine.error && (
        <div className="fixed bottom-4 right-4 z-50 bg-red-600 text-white px-4 py-3 rounded-xl text-sm shadow-lg max-w-sm">
          {engine.error}
        </div>
      )}

      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="bg-gray-200 dark:bg-gray-700 p-2 rounded-full shadow-lg text-gray-800 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </div>
  );
}
