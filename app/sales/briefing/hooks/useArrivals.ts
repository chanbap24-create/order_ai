'use client';
// 최근 통관 완료된 대기 품목 (브리핑 섹션) — 본인 등록 건, 팝업 확인 후에도 14일 유지
import { useEffect, useState } from 'react';
import type { RecentArrival } from '@/app/lib/incomingRequests';

export function useArrivals() {
  const [arrivals, setArrivals] = useState<RecentArrival[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/sales/incoming/arrivals', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (!cancelled && Array.isArray(d.arrivals)) setArrivals(d.arrivals); })
      .catch(() => { /* 섹션 미표시로 조용히 처리 */ });
    return () => { cancelled = true; };
  }, []);
  return arrivals;
}
