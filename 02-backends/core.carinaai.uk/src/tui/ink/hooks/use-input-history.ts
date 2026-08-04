import { useState, useCallback, useEffect } from 'react';
import { loadInputHistory, saveInputHistory } from './input-history-store.js';

export function useInputHistory() {
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setHistory(loadInputHistory());
  }, []);

  const pushToHistory = useCallback((entry: string) => {
    const trimmed = entry.trim();
    if (!trimmed) return;
    setHistory((prev) => {
      const updated = [trimmed, ...prev.filter((e) => e !== trimmed)].slice(0, 1000);
      saveInputHistory(updated);
      return updated;
    });
    setHistoryIndex(-1);
  }, []);

  const navigateHistory = useCallback((direction: 'up' | 'down') => {
    setHistoryIndex((prev) => {
      if (history.length === 0) return -1;
      if (direction === 'up') return Math.min(prev + 1, history.length - 1);
      return Math.max(prev - 1, -1);
    });
  }, [history.length]);

  const resetHistoryIndex = useCallback(() => {
    setHistoryIndex(-1);
  }, []);

  const currentEntry = historyIndex >= 0 ? history[historyIndex] ?? null : null;

  const searchResults = searchMode
    ? history.filter((e) => e.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 8)
    : [];

  return {
    history,
    pushToHistory,
    navigateHistory,
    resetHistoryIndex,
    currentEntry,
    historyIndex,
    searchMode,
    setSearchMode,
    searchQuery,
    setSearchQuery,
    searchResults,
  };
}
