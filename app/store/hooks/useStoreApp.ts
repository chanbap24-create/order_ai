'use client';

// 점장 매장 앱 오케스트레이터 — 로그인/검색/요약. 매장(보기 범위)은 로그인 세션이 정한다(선택·변경 없음). 시안의 "3초 규칙" 준수.
import { useCallback, useEffect, useRef, useState } from 'react';
import { mineOf, type StoreStockRow, type StoreView } from '@/app/lib/store/types';

export type ListMode = 'mine' | 'incoming' | 'arrivals';

export type Summary = {
  my_items: number;
  incoming_items: number;
  recent_arrivals: Array<{ item_no: string; item_name: string; hq_available: number; arrival_date: string }>;
};

const LS_RECENT = 'cave_store_recent';
// 최근 검색에 남길 가치가 있는 쿼리 — 타이핑 중 자모 조각('ㅠ', 'ㅠㅣ')·1글자는 제외
const isMeaningful = (q: string) => q.length >= 2 && !/[ㄱ-ㅎㅏ-ㅣ]/.test(q);

export function useStoreApp() {
  const [authed, setAuthed] = useState<boolean | null>(null); // null=확인 중
  // 보기 범위 — 매장 직원=자기 매장, 본사='all'(전체 매장·조회 전용). canSell=정산·판매 가능
  const [storeKey, setStoreKeyState] = useState<StoreView | ''>('');
  const [canSell, setCanSell] = useState(false);
  // 재고 종류 — 와인/글라스(검색창 스위치). 앱을 열면 항상 와인부터
  const [kind, setKindState] = useState<'wine' | 'glass'>('wine');
  const kindRef = useRef(kind);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<StoreStockRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [detail, setDetail] = useState<StoreStockRow | null>(null);
  const [alts, setAlts] = useState<StoreStockRow[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [error, setError] = useState('');
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 세션 → 로그인 여부·보기 범위·판매 가능. 로그인 직후에도 다시 부른다
  const loadMe = async () => {
    try {
      const r = await fetch('/api/auth/me');
      const j = r.ok ? await r.json() : null;
      const ok = !!j?.authenticated && j?.store === true && !!j?.storeView;
      if (ok) { setStoreKeyState(j.storeView as StoreView); setCanSell(j.canSell === true); }
      setAuthed(ok);
    } catch { setAuthed(false); }
  };

  // 세션 확인 — 매장은 세션의 보기 범위로 고정
  useEffect(() => {
    try {
      setRecent((JSON.parse(localStorage.getItem(LS_RECENT) || '[]') as string[]).filter(isMeaningful));
    } catch { /* ignore */ }
    // 로그인 + 매장 앱 권한(store) 둘 다 있어야 진입 — 권한 없는 영업 계정은 로그인 화면으로
    void loadMe();
    // 서비스워커 등록 (설치 가능 조건)
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/store-sw.js').catch(() => {});
  }, []);

  // 요약 로드
  useEffect(() => {
    if (!authed || !storeKey) return;
    fetch('/api/store/summary')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSummary(d))
      .catch(() => {});
  }, [authed, storeKey]);

  const runSearch = useCallback(async (text: string) => {
    const query = text.trim();
    if (!query) { setRows(null); return; }
    setSearching(true); setError('');
    try {
      // 매장·법인은 서버가 세션으로 정한다
      const res = await fetch(`/api/store/search?q=${encodeURIComponent(query)}&kind=${kindRef.current}`);
      if (res.status === 401 || res.status === 403) { setAuthed(false); return; }
      const j = await res.json();
      setRows(j.rows || []);
      // 최근 검색 (중복 제거, 6개)
      if (isMeaningful(query)) setRecent((prev) => {
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

  const saveRecent = (next: string[]) => {
    setRecent(next);
    try { localStorage.setItem(LS_RECENT, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const clearRecent = () => saveRecent([]);

  // 메뉴(⋮⋮⋮) → 매장 재고·입고 예정·금주 입고 목록. 금주 입고는 summary에 이미 있어 조회 없음
  const [listMode, setListMode] = useState<ListMode | null>(null);
  const [listRows, setListRows] = useState<StoreStockRow[] | null>(null);
  const openList = async (mode: ListMode) => {
    setListMode(mode); setListRows(null);
    if (mode === 'arrivals') return;
    try {
      const res = await fetch(`/api/store/list?mode=${mode}&kind=${kindRef.current}`);
      const j = await res.json();
      setListRows(j.rows || []);
    } catch { setListRows([]); }
  };
  const closeList = () => { setListMode(null); setListRows(null); };

  const openDetail = async (row: StoreStockRow) => {
    setDetail(row); setAlts([]);
    if (!storeKey) return;
    const need = mineOf(row, storeKey) <= 0; // 매장에 없으면 대체품 로드
    if (need) {
      try {
        const res = await fetch(`/api/store/alt?item=${encodeURIComponent(row.item_no)}`);
        const j = await res.json();
        setAlts(j.rows || []);
      } catch { /* ignore */ }
    }
  };

  /** 와인 ↔ 글라스 전환 — 보던 검색어·목록을 새 종류로 다시 조회(입고 예정·금주 입고는 와인 전용이라 닫음) */
  const toggleKind = () => {
    const next = kindRef.current === 'wine' ? 'glass' : 'wine';
    kindRef.current = next; setKindState(next);
    if (q.trim()) void runSearch(q);
    if (listMode === 'mine') void openList('mine');
    else if (listMode) closeList();
  };

  const login = async (manager: string, password: string): Promise<string> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager, password, scope: 'store' }),
      });
      const j = await res.json();
      if (!res.ok) return j.error || '로그인 실패';
      await loadMe();
      return '';
    } catch { return '로그인 실패 — 네트워크를 확인하세요.'; }
  };

  return {
    authed, login, storeKey, canSell, kind, toggleKind,
    q, onInput, rows, searching, error, runSearch,
    summary, recent, clearRecent,
    listMode, listRows, openList, closeList,
    detail, setDetail, alts, openDetail,
  };
}
