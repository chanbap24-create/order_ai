'use client';

// 점장 매장 앱 오케스트레이터 — 로그인/매장선택/검색/요약. 시안의 "3초 규칙" 준수.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { StoreKey, StoreStockRow } from '@/app/lib/store/types';

export type Summary = {
  my_items: number;
  incoming_items: number;
  recent_arrivals: Array<{ item_no: string; item_name: string; hq_available: number; arrival_date: string }>;
};

const LS_STORE = 'cave_store_key';
const LS_RECENT = 'cave_store_recent';

export function useStoreApp() {
  const [authed, setAuthed] = useState<boolean | null>(null); // null=확인 중
  const [storeKey, setStoreKeyState] = useState<StoreKey | ''>('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<StoreStockRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [detail, setDetail] = useState<StoreStockRow | null>(null);
  const [alts, setAlts] = useState<StoreStockRow[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [error, setError] = useState('');
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 세션 확인 + 저장된 매장 복원
  useEffect(() => {
    try {
      setStoreKeyState((localStorage.getItem(LS_STORE) as StoreKey) || '');
      setRecent(JSON.parse(localStorage.getItem(LS_RECENT) || '[]'));
    } catch { /* ignore */ }
    fetch('/api/auth/me').then((r) => setAuthed(r.ok)).catch(() => setAuthed(false));
    // 서비스워커 등록 (설치 가능 조건)
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/store-sw.js').catch(() => {});
  }, []);

  const setStoreKey = (k: StoreKey) => {
    setStoreKeyState(k);
    try { localStorage.setItem(LS_STORE, k); } catch { /* ignore */ }
  };

  // 요약 로드
  useEffect(() => {
    if (!authed || !storeKey) return;
    fetch(`/api/store/summary?store=${storeKey}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSummary(d))
      .catch(() => {});
  }, [authed, storeKey]);

  const runSearch = useCallback(async (text: string) => {
    const query = text.trim();
    if (!query) { setRows(null); return; }
    setSearching(true); setError('');
    try {
      const res = await fetch(`/api/store/search?q=${encodeURIComponent(query)}`);
      if (res.status === 401) { setAuthed(false); return; }
      const j = await res.json();
      setRows(j.rows || []);
      // 최근 검색 (중복 제거, 6개)
      setRecent((prev) => {
        const next = [query, ...prev.filter((p) => p !== query)].slice(0, 6);
        try { localStorage.setItem(LS_RECENT, JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
    } catch {
      setError('검색 실패 — 네트워크를 확인하세요.');
    } finally {
      setSearching(false);
    }
  }, []);

  // 입력 디바운스 검색 (300ms) — "3초 안에 답" 핵심
  const onInput = (text: string) => {
    setQ(text);
    if (debounce.current) clearTimeout(debounce.current);
    if (!text.trim()) { setRows(null); return; }
    debounce.current = setTimeout(() => void runSearch(text), 300);
  };

  const openDetail = async (row: StoreStockRow) => {
    setDetail(row); setAlts([]);
    if (!storeKey) return;
    const need = row.stores[storeKey] <= 0; // 우리 매장에 없으면 대체품 로드
    if (need) {
      try {
        const res = await fetch(`/api/store/alt?item=${row.item_no}&store=${storeKey}`);
        const j = await res.json();
        setAlts(j.rows || []);
      } catch { /* ignore */ }
    }
  };

  const login = async (manager: string, password: string): Promise<string> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager, password }),
      });
      const j = await res.json();
      if (!res.ok) return j.error || '로그인 실패';
      setAuthed(true);
      return '';
    } catch { return '로그인 실패 — 네트워크를 확인하세요.'; }
  };

  return {
    authed, login, storeKey, setStoreKey,
    q, onInput, rows, searching, error, runSearch,
    summary, recent,
    detail, setDetail, alts, openDetail,
  };
}
