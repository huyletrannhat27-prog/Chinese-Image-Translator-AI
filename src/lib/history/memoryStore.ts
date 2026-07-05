// In-memory store dùng cho API /api/history (demo server-side).
// Lưu ý: đây KHÔNG phải nguồn dữ liệu chính của app — frontend dùng
// HistoryStorage (localStorage) trong src/lib/history/storage.ts.
// Dữ liệu ở đây sẽ mất khi server restart, chỉ dùng để demo/kiểm thử API.

export interface HistoryRecord {
  id: string;
  [key: string]: unknown;
}

const MAX_HISTORY = 15000;
let historyStore: HistoryRecord[] = [];

export function getAll(limit: number, offset: number) {
  return {
    items: historyStore.slice(offset, offset + limit),
    total: historyStore.length,
  };
}

export function getById(id: string) {
  return historyStore.find((item) => item.id === id) || null;
}

export function add(record: Omit<HistoryRecord, 'id'> & { id?: string }) {
  const newItem: HistoryRecord = {
    ...record,
    id: record.id || `hist_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  historyStore.unshift(newItem);
  if (historyStore.length > MAX_HISTORY) {
    historyStore = historyStore.slice(0, MAX_HISTORY);
  }
  return newItem;
}

export function removeById(id: string) {
  historyStore = historyStore.filter((item) => item.id !== id);
}

export function clear() {
  historyStore = [];
}
