'use client';

import { useCallback, useEffect, useState } from 'react';

export interface CollItem {
  client_code: string;
  client_type: string;
  client_name: string;
  net_balance: number;
  overdue: number;
  days_overdue: number;
  promised_date: string | null;
  stage: number;
  status: string;
  special: boolean;
}

export interface CollectionBriefing {
  promiseToday: CollItem[];
  broken: CollItem[];
  overdue: CollItem[];
  counts: { promiseToday: number; broken: number; overdue: number; special: number };
}

// 오늘의 수금 브리핑 데이터 로드 (연체/오늘약속/약속어김)
export function useCollectionBriefing(currentManager: string) {
  const [data, setData] = useState<CollectionBriefing | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentManager) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/briefing/collections?manager=${encodeURIComponent(currentManager)}`);
      const j = await res.json();
      if (!j.error) setData(j);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [currentManager]);

  useEffect(() => { load(); }, [load]);

  return { data, loading };
}
