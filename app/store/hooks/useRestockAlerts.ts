'use client';

// 내 입고 알림 — 앱 열 때 조회(서버가 그 자리에서 입고 판정). 입고됨 건수로 배너·메뉴 표시.
import { useCallback, useEffect, useState } from 'react';
import type { RestockAlert } from '@/app/lib/store/restockAlertTypes';
import { readGuest } from '@/app/lib/store/cartSession';

/** 지정 손님 이름으로 입고 알림 신청 — 목록 벨 버튼·상세 버튼 공용. 손님 없으면 false */
export async function requestRestockAlert(itemNo: string, itemName: string, storeKey: string): Promise<boolean> {
  const guest = readGuest();
  if (!guest) return false;
  try {
    const res = await fetch('/api/store/alerts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemNo, itemName, storeKey, customerId: guest.id }),
    });
    return res.ok;
  } catch { return false; }
}

export function useRestockAlerts(enabled: boolean) {
  const [alerts, setAlerts] = useState<RestockAlert[]>([]);

  const refresh = useCallback(async (): Promise<RestockAlert[]> => {
    try {
      const res = await fetch('/api/store/alerts');
      if (res.ok) {
        const list: RestockAlert[] = (await res.json()).alerts || [];
        setAlerts(list);
        return list;
      }
    } catch { /* 네트워크 실패 — 다음 열 때 다시 */ }
    return [];
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(refresh, 0); // 첫 화면 렌더 뒤
    return () => clearTimeout(t);
  }, [enabled, refresh]);

  const act = async (id: number, action: 'done' | 'cancel') => {
    await fetch('/api/store/alerts', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }),
    }).catch(() => {});
    await refresh();
  };

  // 지금 손님으로 신청된 품목(벨 채움) — 누르는 즉시 바뀌게 낙관적 표시(override), 서버 확인 후 정리
  const [override, setOverride] = useState<Record<string, boolean>>({});
  const guestId = readGuest()?.id;
  const mineFor = (list: RestockAlert[], itemNo: string) =>
    list.find((a) => a.status !== 'done' && a.customer_id === guestId && a.item_no === itemNo);
  const alertedItems = new Set(alerts.filter((a) => a.status !== 'done' && a.customer_id === guestId).map((a) => a.item_no));
  for (const [no, on] of Object.entries(override)) { if (on) alertedItems.add(no); else alertedItems.delete(no); }

  /** 벨 토글 — 꺼져 있으면 신청, 켜져 있으면 이 손님 신청 취소 */
  const toggle = async (itemNo: string, itemName: string, storeKey: string) => {
    const on = !alertedItems.has(itemNo);
    setOverride((o) => ({ ...o, [itemNo]: on }));
    let ok = false;
    if (on) ok = await requestRestockAlert(itemNo, itemName, storeKey);
    else {
      const a = mineFor(alerts, itemNo) || mineFor(await refresh(), itemNo); // 방금 신청한 건 목록 갱신 후 찾기
      if (a) {
        const res = await fetch('/api/store/alerts', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, action: 'cancel' }),
        }).catch(() => null);
        ok = !!res?.ok;
      }
    }
    await refresh();
    setOverride((o) => { const next = { ...o }; delete next[itemNo]; return next; });
    return ok;
  };

  const arrived = alerts.filter((a) => a.status === 'arrived');
  const waiting = alerts.filter((a) => a.status === 'waiting');
  // 메뉴 타일 점 — 입고됨(연락 필요)=빨강, 대기만=초록
  const tileDot: 'red' | 'green' | null = arrived.length ? 'red' : waiting.length ? 'green' : null;
  return { alerts, arrived, waiting, refresh, act, alertedItems, toggle, tileDot };
}
