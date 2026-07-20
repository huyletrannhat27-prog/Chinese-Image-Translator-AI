'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trash2, Download, Copy, History, Sparkles } from 'lucide-react';
import { TranslationResult } from '@/types';
import { HistoryStorage } from '@/lib/history/storage';

export default function HistoryPage() {
  const [history, setHistory] = useState<TranslationResult[]>([]);

  useEffect(() => {
    setHistory(HistoryStorage.load());
  }, []);

  const deleteItem = (id: string) => {
    setHistory(HistoryStorage.removeItem(id));
  };

  const clearAll = () => {
    if (confirm('Xóa tất cả lịch sử?')) {
      HistoryStorage.clear();
      setHistory([]);
    }
  };

  const exportData = () => {
    const data = HistoryStorage.exportJSON();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `history_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen px-4 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between rounded-2xl border border-white/80 bg-white/75 p-3 shadow-sm backdrop-blur-xl sm:p-4">
          <Link
            href="/"
            className="icon-button"
            aria-label="Quay lại"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="text-center"><p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Hanzi Lens</p><h1 className="font-black text-slate-950">Lịch sử dịch</h1></div>
          <div className="flex gap-2">
            {history.length > 0 && (
              <>
                <button
                  onClick={exportData}
                  className="icon-button"
                  title="Xuất dữ liệu"
                >
                  <Download size={18} className="text-gray-600 dark:text-gray-300" />
                </button>
                <button
                  onClick={clearAll}
                  className="icon-button hover:!border-rose-200 hover:!text-rose-600"
                  title="Xóa tất cả"
                >
                  <Trash2 size={18} />
                </button>
              </>
            )}
          </div>
        </div>

        {history.length === 0 ? (
          <div className="surface-card rounded-[1.75rem] px-6 py-20 text-center text-slate-400">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-indigo-50 text-indigo-500"><History size={30} /></div>
            <p className="mt-5 text-lg font-bold text-slate-800">Chưa có bản dịch nào</p>
            <p className="mt-2 text-sm">Bản dịch gần đây sẽ xuất hiện tại đây</p>
            <Link
              href="/"
              className="primary-button mt-6"
            >
              <Sparkles size={17} /> Dịch ảnh đầu tiên
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {history.map((item) => (
              <div
                key={item.id}
                className="surface-card rounded-[1.35rem] p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold leading-6 text-slate-900">
                      {item.originalText.slice(0, 100)}...
                    </p>
                    <p className="mt-2 leading-6 text-emerald-600">
                      {item.translation.slice(0, 100)}...
                    </p>
                    <p className="mt-4 text-xs font-medium text-slate-400">
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
