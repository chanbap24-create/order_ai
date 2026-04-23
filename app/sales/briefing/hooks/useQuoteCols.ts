'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_BRIEFING_COLS } from '../constants';

const STORAGE_KEY = 'briefing_quote_columns';

export function useQuoteCols() {
  const [quoteCols, setQuoteCols] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return DEFAULT_BRIEFING_COLS;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(quoteCols)); } catch {}
  }, [quoteCols]);

  const toggle = (key: string) => {
    setQuoteCols(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const reset = () => setQuoteCols(DEFAULT_BRIEFING_COLS);

  return { quoteCols, toggle, reset };
}
