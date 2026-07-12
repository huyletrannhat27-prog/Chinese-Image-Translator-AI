'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, Trash2, Download, Copy, Search, X, Clock } from 'lucide-react';

interface HistoryItem {
  id: string;
  originalText: string;
  translation: string;
  detectedScript: 'simplified' | 'traditional' | 'mixed';
  confidence: number;
  createdAt: Date;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    const saved = localStorage.getItem('translation_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const items = parsed.map((item: any) => ({
          ...item,
          createdAt: new Date(item.createdAt),
        }));
        setHistory(items);
        setFilteredHistory(items);
      } catch (e) {
        console.error('Lỗi tải lịch sử:', e);
      }
    }
  };

  const deleteItem = (id: string) => {
    if (!confirm('Xóa mục này?')) return;
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    setFilteredHistory(updated);
    localStorage.setItem('translation_history', JSON.stringify(updated));
  };

  const clearAll = () => {
    if (!confirm('Xóa toàn bộ lịch sử?')) return;
    setHistory([]);
    setFilteredHistory([]);
    localStorage.removeItem('translation_history');
  };

  const exportData = () => {
    if (history.length === 0) return;
    const data = history.map(item => ({
      'Văn bản gốc': item.originalText,
      'Bản dịch': item.translation,
      'Độ chính xác': `${Math.round(item.confidence * 100)}%`,
      'Thời gian': new Date(item.createdAt).toLocaleString('vi-VN'),
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lich_su_dich_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#1e293b] text-white px-5 py-3 rounded-xl shadow-2xl z-50 text-sm font-medium';
    toast.textContent = 'Đã sao chép!';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setFilteredHistory(history);
    } else {
      const lower = query.toLowerCase();
      setFilteredHistory(history.filter(item =>
        item.originalText.toLowerCase().includes(lower) ||
        item.translation.toLowerCase().includes(lower)
      ));
    }
  };

  const getScriptLabel = (script: string) => {
    return script === 'simplified' ? '简体' : script === 'traditional' ? '繁體' : '混';
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0f172a]">
      {/* Header */}
      <header className="bg-white/80 dark:bg-[#1e293b]/80 backdrop-blur-xl border-b border-[#e2e8f0] dark:border-[#334155] sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-3 text-[#0f172a] dark:text-[#f8fafc] hover:text-blue-600 dark:hover:text-blue-400 transition"
          >
            <div className="p-1.5 rounded-xl hover:bg-[#f1f5f9] dark:hover:bg-[#334155] transition">
              <ArrowLeft size={18} />
            </div>
            <div>
              <h1 className="text-base font-semibold">Lịch sử dịch</h1>
              <p className="text-[10px] text-[#64748b] dark:text-[#94a3b8] font-medium">
                {history.length} bản dịch
              </p>
            </div>
          </Link>
          <div className="flex gap-1.5">
            {history.length > 0 && (
              <>
                <button
                  onClick={exportData}
                  className="p-2 rounded-xl hover:bg-[#f1f5f9] dark:hover:bg-[#334155] transition text-[#64748b] dark:text-[#94a3b8]"
                  title="Xuất dữ liệu"
                >
                  <Download size={18} />
                </button>
                <button
                  onClick={clearAll}
                  className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition text-[#64748b] dark:text-[#94a3b8] hover:text-red-500"
                  title="Xóa tất cả"
                >
                  <Trash2 size={18} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Search */}
        {history.length > 0 && (
          <motion.div
            initial={{ y: 5, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="relative mb-6"
          >
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] dark:text-[#64748b]" />
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] focus:border-blue-400 dark:focus:border-blue-500 outline-none transition text-[#0f172a] dark:text-[#f8fafc] text-sm placeholder:text-[#94a3b8] dark:placeholder:text-[#64748b]"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearch('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b] transition"
              >
                <X size={16} />
              </button>
            )}
          </motion.div>
        )}

        {/* Empty State */}
        {history.length === 0 && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center py-20"
          >
            <div className="text-6xl mb-4 opacity-30">📭</div>
            <h2 className="text-xl font-semibold text-[#0f172a] dark:text-[#f8fafc] mb-1">
              Chưa có lịch sử
            </h2>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-6">
              Hãy dịch một ảnh để bắt đầu
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition text-sm font-medium"
            >
              <span>📸</span> Dịch ngay
            </Link>
          </motion.div>
        )}

        {/* History List */}
        {filteredHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2.5"
          >
            {filteredHistory.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: index * 0.03 }}
                className="group bg-white dark:bg-[#1e293b] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#334155] hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-200"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                      <span className="text-sm font-medium text-[#0f172a] dark:text-[#f8fafc]">
                        {item.originalText.slice(0, 60)}...
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium">
                        {getScriptLabel(item.detectedScript)}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 font-medium">
                        {Math.round(item.confidence * 100)}%
                      </span>
                    </div>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      → {item.translation.slice(0, 80)}...
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-[#94a3b8] dark:text-[#64748b]">
                      <Clock size={12} />
                      <span>{new Date(item.createdAt).toLocaleString('vi-VN')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => copyText(item.translation)}
                      className="p-1.5 rounded-lg hover:bg-[#f1f5f9] dark:hover:bg-[#334155] transition text-[#94a3b8] hover:text-[#64748b]"
                      title="Copy"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition text-[#94a3b8] hover:text-red-500"
                      title="Xóa"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Search no result */}
        {history.length > 0 && filteredHistory.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-[#94a3b8] dark:text-[#64748b]">
              Không tìm thấy kết quả cho "{searchQuery}"
            </p>
          </div>
        )}
      </main>
    </div>
  );
}