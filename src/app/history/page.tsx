'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trash2, Download, Copy } from 'lucide-react';

interface HistoryItem {
  id: string;
  originalText: string;
  translation: string;
  createdAt: string;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('translation_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load history:', e);
      }
    }
  }, []);

  const deleteItem = (id: string) => {
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    localStorage.setItem('translation_history', JSON.stringify(updated));
  };

  const clearAll = () => {
    if (confirm('Xóa tất cả lịch sử?')) {
      setHistory([]);
      localStorage.removeItem('translation_history');
    }
  };

  const exportData = () => {
    const data = JSON.stringify(history, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `history_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft size={20} />
            Quay lại
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            📋 Lịch sử dịch
          </h1>
          <div className="flex gap-2">
            {history.length > 0 && (
              <>
                <button
                  onClick={exportData}
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition"
                >
                  <Download size={18} className="text-gray-600 dark:text-gray-300" />
                </button>
                <button
                  onClick={clearAll}
                  className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition"
                >
                  <Trash2 size={18} />
                </button>
              </>
            )}
          </div>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-6xl mb-4">📭</p>
            <p className="text-lg">Chưa có lịch sử dịch</p>
            <p className="text-sm mt-2">Hãy dịch một ảnh để bắt đầu</p>
            <Link
              href="/"
              className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Dịch ngay
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 dark:text-white font-medium">
                      {item.originalText.slice(0, 100)}...
                    </p>
                    <p className="text-green-600 dark:text-green-400 mt-1">
                      {item.translation.slice(0, 100)}...
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-1 ml-4">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(item.translation);
                      }}
                      className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition"
                    >
                      <Copy size={16} className="text-gray-400" />
                    </button>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                    >
                      <Trash2 size={16} className="text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}