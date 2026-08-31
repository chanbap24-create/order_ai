'use client';

import { useCallback, useState } from 'react';
import type { ClientInfo, LedgerRow, LedgerType, PaymentRow, SuggestionItem } from '../types';

type Args = {
  selectedClient: SuggestionItem | null;
  startDate: string;
  endDate: string;
  type: LedgerType;
};

export function useLedgerQuery({ selectedClient, startDate, endDate, type }: Args) {
  const [loading, setLoading] = useState(false);
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [prevBalance, setPrevBalance] = useState(0);
  const [error, setError] = useState('');
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());

  const handleSearch = useCallback(async () => {
    if (!selectedClient) {
      setError('거래처를 선택해주세요.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const params = new URLSearchParams({
        client_code: selectedClient.code,
        start_date: startDate,
        end_date: endDate,
        type,
      });
      const res = await fetch(`/api/sales/ledger?${params}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setClient(data.client);
      setRows(data.rows || []);
      setPayments(data.payments || []);
      setPrevBalance(data.prev_balance || 0);
      setCollapsedMonths(new Set());
      setCollapsedDays(new Set());
    } catch {
      setError('조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [selectedClient, startDate, endDate, type]);

  const toggleMonth = (m: string) => {
    setCollapsedMonths(prev => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m); else next.add(m);
      return next;
    });
  };

  const toggleDay = (d: string) => {
    setCollapsedDays(prev => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  };

  /** 조회 결과 전체 비우기 (초기화 버튼용) */
  const clear = useCallback(() => {
    setClient(null);
    setRows([]);
    setPayments([]);
    setPrevBalance(0);
    setError('');
    setCollapsedMonths(new Set());
    setCollapsedDays(new Set());
  }, []);

  return {
    loading, client, rows, payments, prevBalance, error,
    collapsedMonths, collapsedDays,
    handleSearch, toggleMonth, toggleDay, clear,
  };
}
