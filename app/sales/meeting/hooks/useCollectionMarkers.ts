'use client';

import { useEffect, useState } from 'react';

export interface CollMarker {
  date: string;
  client_code: string;
  client_type: string;
  client_name: string;
  amount: number;
  kind: 'promise' | 'broken' | 'special';
  special: boolean;
}

// 미팅 달력용 수금 마커(수금약속일/특별관리)를 날짜별로 묶어 반환.
export function useCollectionMarkers(manager: string, dateFrom: string, dateTo: string) {
  const [byDate, setByDate] = useState<Record<string, CollMarker[]>>({});

  useEffect(() => {
    if (!manager || !dateFrom || !dateTo) { setByDate({}); return; }
    let alive = true;
    fetch(`/api/sales/meetings/collection-markers?manager=${encodeURIComponent(manager)}&date_from=${dateFrom}&date_to=${dateTo}`)
      .then(r => r.json())
      .then(j => {
        if (!alive || j.error) return;
        const map: Record<string, CollMarker[]> = {};
        for (const m of (j.markers || [])) (map[m.date] ||= []).push(m);
        setByDate(map);
      })
      .catch(() => { /* ignore */ });
    return () => { alive = false; };
  }, [manager, dateFrom, dateTo]);

  return byDate;
}
