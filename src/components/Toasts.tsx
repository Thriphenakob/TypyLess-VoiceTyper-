import React from 'react';
import { Check, RefreshCw, Mic } from 'lucide-react';
import { motion } from 'motion/react';

interface ToastsProps {
  isRecording: boolean;
  isProcessing: boolean;
  showSuccess: boolean;
  wordCount?: number;
  statusMessage?: string;
}

export default function Toasts({ isRecording, isProcessing, showSuccess, wordCount = 0, statusMessage = '' }: ToastsProps) {
  if (!isRecording && !isProcessing && !showSuccess) return null;

  return (
    <motion.div
      drag
      dragMomentum={false}
      className="fixed bottom-8 right-8 z-[100] flex flex-col items-end gap-3 cursor-move"
      style={{ touchAction: 'none' }}
    >
      {showSuccess && (
        <div className="bg-gray-900/90 dark:bg-black/90 text-white backdrop-blur-sm px-4 py-2.5 rounded-full shadow-xl flex items-center gap-3 border border-white/10 pointer-events-none">
          <div className="bg-green-500 rounded-full p-0.5">
            <Check size={14} strokeWidth={3} className="text-white" />
          </div>
          <span className="text-sm font-medium tracking-wide">已插入 {wordCount} 个字符</span>
        </div>
      )}

      {isProcessing && (
        <div className="bg-gray-900/90 dark:bg-black/90 text-white backdrop-blur-sm px-4 py-2.5 rounded-full shadow-xl flex items-center gap-3 border border-white/10 pointer-events-none">
          <RefreshCw size={18} className="text-blue-400 animate-spin" />
          <span className="text-sm font-medium tracking-wide">{statusMessage || '正在处理...'}</span>
        </div>
      )}

      {isRecording && (
        <div className="bg-gray-900/90 dark:bg-black/90 text-white backdrop-blur-sm px-5 py-3 rounded-full shadow-xl flex items-center gap-4 border border-white/10 pointer-events-none">
          <div className="bg-red-500/20 p-1.5 rounded-full">
            <Mic size={18} className="text-red-500" />
          </div>
          <div className="flex items-center gap-1 h-4">
            <div className="w-1 bg-white/80 rounded-full h-1 animate-[wave_1s_infinite_ease-in-out]"></div>
            <div className="w-1 bg-white/80 rounded-full h-3 animate-[wave_1s_infinite_ease-in-out_0.1s]"></div>
            <div className="w-1 bg-white/80 rounded-full h-2 animate-[wave_1s_infinite_ease-in-out_0.2s]"></div>
            <div className="w-1 bg-white/80 rounded-full h-4 animate-[wave_1s_infinite_ease-in-out_0.3s]"></div>
          </div>
          <span className="text-sm font-medium tracking-wide pl-1">{statusMessage || '正在录音...'}</span>
        </div>
      )}
    </motion.div>
  );
}
