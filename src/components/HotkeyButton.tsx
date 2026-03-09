import React, { useState } from 'react';

export function HotkeyButton({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    const [recording, setRecording] = useState(false);

    const handleRecord = () => {
        setRecording(true);
        const handler = (e: KeyboardEvent) => {
            e.preventDefault();
            let key = e.key === ' ' ? 'Space' : e.key;

            // Basic translation for some common keys
            if (key.length === 1 && key.match(/[a-z]/i)) {
                key = key.toUpperCase();
            }

            // Ignore standalone modifier key down events
            if (['Alt', 'Control', 'Shift', 'Meta', 'Process'].includes(key)) {
                return; // Wait for the concrete key press
            }

            // Simple combo support (e.g. Ctrl+A)
            if (e.ctrlKey && key !== 'Control') key = `CommandOrControl+${key}`;
            else if (e.altKey && key !== 'Alt') key = `Alt+${key}`;
            else if (e.shiftKey && key !== 'Shift') key = `Shift+${key}`;

            onChange(key);
            setRecording(false);
            window.removeEventListener('keydown', handler);
        };
        window.addEventListener('keydown', handler);
    };

    return (
        <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
            <button
                onClick={handleRecord}
                className={`px-4 py-2 rounded-lg text-sm font-mono font-semibold transition-all ${recording
                    ? 'bg-red-100 dark:bg-red-600/20 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-500/50 animate-pulse'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
            >
                {recording ? '按下新键...' : value}
            </button>
        </div>
    );
}
