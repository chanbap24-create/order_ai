'use client';

// 어드민 소믈리에 탭 배지 — 매장 직원 수정 요청 대기 건수. 탭 안 목록이 처리 시 setCount로 동기화.
import { useEffect, useState } from 'react';

export function useSommelierRequestCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    fetch('/api/sommelier/requests', { headers: { 'X-Track-Skip': '1' } })
      .then((r) => (r.ok ? r.json() : { requests: [] }))
      .then((j: { requests?: { status: string }[] }) => {
        if (alive) setCount((j.requests || []).filter((r) => r.status === 'open').length);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return { count, setCount };
}
