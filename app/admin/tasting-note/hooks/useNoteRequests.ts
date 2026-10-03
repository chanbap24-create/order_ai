'use client';

// 매장 직원 '수정 요청' 중 테이스팅 노트 요청(미처리)만 — 어드민 테이스팅노트 탭 '매장 요청' 필터용.
// 데이터·처리는 소믈리에 수정 요청 API(/api/sommelier/requests) 그대로 사용.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeRequest } from '@/app/lib/sommelierRequestTypes';

export function useNoteRequests(onCountChange?: (n: number) => void) {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/sommelier/requests', { headers: { 'X-Track-Skip': '1' } });
      if (!r.ok) return;
      const list = ((await r.json()).requests || []) as ChangeRequest[];
      setRequests(list.filter((x) => x.category === 'note' && x.status === 'open'));
    } catch { /* 네트워크 실패 — 다음 진입 때 다시 */ }
  }, []);

  useEffect(() => { const t = setTimeout(refresh, 0); return () => clearTimeout(t); }, [refresh]);
  useEffect(() => { onCountChange?.(requests.length); }, [requests.length, onCountChange]);

  /** 처리 완료 — 목록에서 바로 빼고 서버 반영 */
  const resolve = async (id: number) => {
    setRequests((rs) => rs.filter((x) => x.id !== id));
    await fetch('/api/sommelier/requests', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, done: true }),
    }).catch(() => {});
  };

  const itemNos = useMemo(() => new Set(requests.map((r) => r.item_no)), [requests]);
  return { requests, itemNos, resolve, refresh };
}
