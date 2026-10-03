'use client';

// 고객 이름 검색(250ms 디바운스) — 고객 목록 페이지·손님 찾기 시트 공용. 보기 범위는 서버(세션) 기준.
import { useEffect, useState } from 'react';
import type { CustomerListRow } from '@/app/lib/sommelierCustomerCard';

export function useCustomerSearch(q: string) {
  const [rows, setRows] = useState<CustomerListRow[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/sommelier/customers?q=${encodeURIComponent(q.trim())}`)
        .then(async (r) => { const j = await r.json(); if (r.ok) { setRows(j.customers || []); setError(''); } else setError(j.error || '불러오지 못했습니다.'); })
        .catch(() => setError('네트워크를 확인하세요.'));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  return { rows, error };
}
