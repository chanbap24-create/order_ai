'use client';

import { useEffect, useRef, useState } from 'react';
import { logger } from '@/app/lib/logger';
import { DEFAULT_REC_COLS } from '../constants';

// 견적 컬럼 설정: 계정별(서버 user_preferences) 저장 + localStorage 즉시표시 캐시.
const STORAGE_KEY = 'recommend_quote_columns';
const PREF_KEY = 'recommend_quote_columns';

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
  // 서버 로드 완료 전엔 서버 저장 안 함(초기 캐시값이 계정 설정을 덮어쓰는 것 방지)
  const loaded = useRef(false);

  // 마운트 시 계정 설정 로드 → 기기 무관 유지
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/user/preferences', { credentials: 'include' });
        if (res.ok) {
          const j = await res.json();
          const v = j.preferences?.[PREF_KEY];
          if (alive && Array.isArray(v) && v.length > 0) setQuoteCols(v);
        }
      } catch (e) { logger.debug('설정 로드 실패(무시)', { error: String(e) }); }
      finally { loaded.current = true; }
    })();
    return () => { alive = false; };
  }, []);

  // 변경 시 localStorage(즉시) + 계정 설정(서버) 저장
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(quoteCols)); } catch (e) { logger.debug('비치명적 실패(기본값·무시)', { error: String(e) }); }
    if (!loaded.current) return;
    fetch('/api/user/preferences', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: PREF_KEY, value: quoteCols }),
    }).catch(() => { /* 저장 실패는 비치명적 */ });
  }, [quoteCols]);

  const toggle = (key: string) => {
    setQuoteCols(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  // 컬럼 순서 교체(드래그앤드롭) — 배열 순서가 곧 엑셀 열 순서
  const reorder = (next: string[]) => setQuoteCols(next);

  const reset = () => setQuoteCols(DEFAULT_REC_COLS);

  return { quoteCols, toggle, reorder, reset };
}
