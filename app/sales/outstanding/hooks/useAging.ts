'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AgingClient, AgingRow, Followup, OutstandingType } from '../types';

type Args = { currentManager: string; type: OutstandingType; asOf: string; enabled?: boolean };

// 미수금 연령 분석 + 수금 followup 을 함께 조회·병합한다.
export function useAging({ currentManager, type, asOf, enabled = true }: Args) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<AgingRow[]>([]);
  // 최근 3개월 수금 총액(완납 거래처 포함 — 표에 안 보이는 거래처까지). null = 미제공.
  const [recentPaymentTotal, setRecentPaymentTotal] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    if (!currentManager || !enabled) return;
    setLoading(true);
    setError('');
    try {
      const qs = `manager=${encodeURIComponent(currentManager)}&type=${type}`;
      const [agingRes, foRes] = await Promise.all([
        fetch(`/api/sales/outstanding/aging?${qs}&as_of=${asOf}`).then(r => r.json()),
        fetch(`/api/sales/collections?${qs}`).then(r => r.json()).catch(() => ({ followups: [] })),
      ]);
      if (agingRes.error) throw new Error(agingRes.error);

      const foMap = new Map<string, Followup>();
      for (const f of (foRes.followups || [])) foMap.set(f.client_code, f);

      const merged: AgingRow[] = (agingRes.clients as AgingClient[] || []).map(c => ({
        ...c,
        followup: foMap.get(c.client_code),
      }));
      setRows(merged);
      setRecentPaymentTotal(typeof agingRes.recent_payment_total === 'number' ? agingRes.recent_payment_total : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [currentManager, type, asOf, enabled]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // followup 저장(낙관적 업데이트). 실패 시 재조회로 롤백.
  const saveFollowup = useCallback(async (clientCode: string, patch: Partial<Followup>) => {
    const prev = rows.find(r => r.client_code === clientCode)?.followup;
    const next: Followup = {
      client_code: clientCode,
      client_type: type,
      stage: patch.stage ?? prev?.stage ?? 0,
      status: patch.status ?? prev?.status ?? 'open',
      promised_date: patch.promised_date !== undefined ? patch.promised_date : (prev?.promised_date ?? null),
      promised_amount: patch.promised_amount !== undefined ? patch.promised_amount : (prev?.promised_amount ?? null),
      memo: patch.memo !== undefined ? patch.memo : (prev?.memo ?? null),
      payment_type: patch.payment_type !== undefined ? patch.payment_type : (prev?.payment_type ?? null),
    };
    setRows(rs => rs.map(r => r.client_code === clientCode ? { ...r, followup: next } : r));
    try {
      const res = await fetch('/api/sales/collections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...next, manager: currentManager }),
      });
      if (!res.ok) throw new Error((await res.json()).error || '저장 실패');
    } catch {
      fetchData();
    }
  }, [rows, type, currentManager, fetchData]);

  return { loading, error, rows, recentPaymentTotal, fetchData, saveFollowup };
}
