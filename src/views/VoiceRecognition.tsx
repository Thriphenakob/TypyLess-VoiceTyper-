import React from 'react';
import Header from '../components/Header';
import { Brain, ChevronDown, Lock, Mic, Monitor, MicOff, Circle, RefreshCw } from 'lucide-react';

export default function VoiceRecognition() {
  return (
    <div className="flex flex-col h-full relative">
      <Header title="语音识别" subtitle="配置您的语音模型和麦克风设置。" />
      
      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        <div className="max-w-4xl mx-auto space-y-8">
          
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Brain size={18} /> 模型配置
            </h3>
            <div className="bg-gray-50 dark:bg-[#18181b] rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">AI 模型</label>
                  <div className="relative">
                    <select className="w-full bg-white dark:bg-[#1c1f26] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 appearance-none pr-10 shadow-sm">
                      <option>Whisper Base (最快)</option>
                      <option>Whisper Small (平衡)</option>
                      <option>Whisper Medium (更高精度)</option>
                      <option selected>Whisper Large V3 (最佳精度)</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-3 text-gray-500 pointer-events-none" />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">较大的模型提供更高的精度，但需要更多的系统资源。</p>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">输入语言</label>
                  <div className="relative">
                    <select className="w-full bg-white dark:bg-[#1c1f26] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 appearance-none pr-10 shadow-sm">
                      <option selected>自动检测</option>
                      <option>英语 (美国)</option>
                      <option>中文 (普通话)</option>
                      <option>西班牙语</option>
                      <option>法语</option>
                      <option>日语</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-3 text-gray-500 pointer-events-none" />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">自动检测会在初始处理时稍微增加延迟。</p>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800 flex items-start space-x-3">
                <div className="flex-shrink-0 mt-0.5">
                  <Lock size={18} className="text-green-500" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">仅本地处理</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">您的语音数据从未离开您的设备。所有处理均在本地进行，以确保最大的隐私和安全性。</p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Mic size={18} /> 音频输入
            </h3>
            <div className="bg-gray-50 dark:bg-[#18181b] rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-end gap-6">
                <div className="flex-1 space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">麦克风设备</label>
                  <div className="relative">
                    <select className="w-full bg-white dark:bg-[#1c1f26] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 appearance-none pr-10 shadow-sm">
                      <option>默认系统设备</option>
                      <option selected>MacBook Pro 麦克风</option>
                      <option>AirPods Pro</option>
                      <option>Blue Yeti X</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-3 text-gray-500 pointer-events-none" />
                  </div>
                </div>
                <button className="bg-white dark:bg-[#1c1f26] border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-white font-medium py-2.5 px-4 rounded-lg flex items-center space-x-2 transition-colors shadow-sm">
                  <Mic size={18} className="text-blue-600" />
                  <span>测试麦克风</span>
                </button>
              </div>
              
              <div className="mt-6">
                <div className="flex justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">输入电平</span>
                  <span className="text-xs font-medium text-green-500">良好</span>
                </div>
                <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded-md flex items-end justify-between px-1 pb-1 gap-1 overflow-hidden">
                  {/* Generate some random height bars for the visualizer */}
                  {[...Array(40)].map((_, i) => {
                    const heights = [30, 45, 60, 40, 55, 75, 90, 65, 50, 35];
                    const height = heights[i % heights.length];
                    const opacity = height / 100;
                    return (
                      <div 
                        key={i} 
                        className="w-1 bg-green-500 rounded-t-sm" 
                        style={{ height: `${height}%`, opacity: opacity }}
                      ></div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4 pb-10">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Monitor size={18} /> 系统集成
            </h3>
            <div className="bg-gray-50 dark:bg-[#18181b] rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                VoiceTyper 在系统托盘中运行。以下是状态图标的预览：
              </p>
              <div className="flex items-center space-x-8">
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-800 rounded-lg flex items-center justify-center border border-gray-300 dark:border-gray-600">
                    <MicOff size={20} className="text-gray-500 dark:text-gray-400" />
                  </div>
                  <span className="text-xs text-gray-500">待机</span>
                </div>
                <div className="w-px h-10 bg-gray-200 dark:bg-gray-700"></div>
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center border border-red-200 dark:border-red-900 animate-pulse">
                    <Circle size={16} className="text-red-500 fill-current" />
                  </div>
                  <span className="text-xs text-gray-500">录音中</span>
                </div>
                <div className="w-px h-10 bg-gray-200 dark:bg-gray-700"></div>
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center border border-blue-200 dark:border-blue-900">
                    <RefreshCw size={20} className="text-blue-500 animate-spin" />
                  </div>
                  <span className="text-xs text-gray-500">处理中</span>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white dark:from-[#1c1f26] to-transparent pointer-events-none"></div>
    </div>
  );
}
