'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PaymentType } from '../../outstanding/lib/dueDate';
import type { OutstandingType } from '../../outstanding/types';

export interface ClientTerm {
  client_code: string;
  client_name: string;
  payment_type: PaymentType | null;
}

// 매니저의 거래처 목록 + 결제조건 조회/저장 (결제일 설정 전용 화면)
export function usePaymentTerms({ manager, type }: { manager: string; type: OutstandingType }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<ClientTerm[]>([]);
  const [savingCode, setSavingCode] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!manager) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/sales/payment-terms?manager=${encodeURIComponent(manager)}&type=${type}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRows(data.clients || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [manager, type]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 결제조건만 부분 저장(낙관적). 기존 독촉/약속/메모는 서버에서 유지.
  const saveTerm = useCallback(async (code: string, pt: PaymentType | null) => {
    setRows(rs => rs.map(r => r.client_code === code ? { ...r, payment_type: pt } : r));
    setSavingCode(code);
    try {
      const res = await fetch('/api/sales/collections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_code: code, client_type: type, payment_type: pt, manager }),
      });
      if (!res.ok) throw new Error((await res.json()).error || '저장 실패');
    } catch {
      fetchData();
    } finally {
      setSavingCode(null);
    }
  }, [type, manager, fetchData]);

  return { loading, error, rows, savingCode, saveTerm, refetch: fetchData };
}
