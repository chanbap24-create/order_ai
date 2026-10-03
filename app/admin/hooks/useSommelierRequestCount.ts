'use client';

// 어드민 탭 배지 — 매장 직원 수정 요청 대기 건수(소믈리에 탭) + 그중 테이스팅 노트 요청(테이스팅노트 탭).
// 탭 안 목록이 처리 시 setCount·setNoteCount로 동기화.
import { useEffect, useState } from 'react';

export function useSommelierRequestCount() {
  const [count, setCount] = useState(0);
  const [noteCount, setNoteCount] = useState(0);
  useEffect(() => {
    let alive = true;
    fetch('/api/sommelier/requests', { headers: { 'X-Track-Skip': '1' } })
      .then((r) => (r.ok ? r.json() : { requests: [] }))
      .then((j: { requests?: { status: string; category: string }[] }) => {
        if (!alive) return;
        const open = (j.requests || []).filter((r) => r.status === 'open');
        setCount(open.length);
        setNoteCount(open.filter((r) => r.category === 'note').length);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return { count, setCount, noteCount, setNoteCount };
}
