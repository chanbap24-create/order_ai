'use client';

import { useCallback, useEffect, useState } from 'react';

export interface CollItem {
  client_code: string;
  client_type: string;
  client_name: string;
  net_balance: number;
  overdue: number;
  days_overdue: number;
  due_date: string | null;
  oldest_unpaid_date: string | null;
  promised_date: string | null;
  promised_amount: number | null;
  stage: number;
  status: string;
  special: boolean;
  hidden: boolean;
}

export interface CollectionBriefing {
  promiseToday: CollItem[];
  broken: CollItem[];
  overdue: CollItem[];
  counts: { promiseToday: number; broken: number; overdue: number; special: number };
  /** 발신자(담당) — 수금 안내 문구 서명용 (구 캐시엔 없을 수 있음) */
  sender?: { manager: string; title: string | null };
}

// 마지막 결과를 탭 세션에 보관 → 재진입 시 즉시 표시(stale-while-revalidate).
// aging 계산은 ~2초 소요되므로, 캐시를 먼저 그리고 백그라운드로 갱신해 "늦게뜸" 체감을 제거.
// 서버는 항상 fresh 계산하므로 미수 수치 정확성에는 무영향(캐시는 표시용 임시값).
const cacheKey = (m: string) => `briefing-collections:${m}`;
function readCache(m: string): CollectionBriefing | null {
  try { const s = sessionStorage.getItem(cacheKey(m)); return s ? JSON.parse(s) : null; } catch { return null; }
}

// 오늘의 수금 브리핑 데이터 로드 (연체/오늘약속/약속어김)
export function useCollectionBriefing(currentManager: string) {
  const [data, setData] = useState<CollectionBriefing | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentManager) return;
    // 캐시가 있으면 즉시 표시(로딩 스피너 생략), 없으면 로딩 표시.
    const cached = readCache(currentManager);
    if (cached) { setData(cached); setLoading(false); } else { setLoading(true); }
    try {
      const res = await fetch(`/api/sales/briefing/collections?manager=${encodeURIComponent(currentManager)}`);
      const j = await res.json();
      if (!j.error) {
        setData(j);
        try { sessionStorage.setItem(cacheKey(currentManager), JSON.stringify(j)); } catch { /* quota */ }
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [currentManager]);

  useEffect(() => { load(); }, [load]);

  // 수금일/금액 등 저장 후 재조회
  const saveFollowup = useCallback(async (clientCode: string, clientType: string, patch: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/sales/collections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_code: clientCode, client_type: clientType, manager: currentManager, ...patch }),
      });
      if (!res.ok) throw new Error('저장 실패');
      await load();
    } catch { /* ignore */ }
  }, [currentManager, load]);

  return { data, loading, saveFollowup };
}
