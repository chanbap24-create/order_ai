'use client';

import { useEffect, useState } from 'react';
import { logger } from '@/app/lib/logger';
import { DEFAULT_REC_COLS } from '../constants';

const STORAGE_KEY = 'recommend_quote_columns';

export function useQuoteCols() {
  const [quoteCols, setQuoteCols] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch (e) { logger.debug('비치명적 실패(기본값·무시)', { error: String(e) }); }
    }
    return DEFAULT_REC_COLS;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(quoteCols)); } catch (e) { logger.debug('비치명적 실패(기본값·무시)', { error: String(e) }); }
  }, [quoteCols]);

  const toggle = (key: string) => {
    setQuoteCols(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const reset = () => setQuoteCols(DEFAULT_REC_COLS);

  return { quoteCols, toggle, reset };
}
