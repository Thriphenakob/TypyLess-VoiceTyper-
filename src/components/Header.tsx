import React from 'react';
import { MoreHorizontal } from 'lucide-react';

export default function Header({ title, subtitle }: { title: string, subtitle?: string }) {
  return (
    <header className="h-20 flex-shrink-0 flex items-center justify-between px-8 border-b border-gray-100 dark:border-gray-800">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
      </div>
      <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
        <MoreHorizontal size={20} />
      </button>
    </header>
  );
}
