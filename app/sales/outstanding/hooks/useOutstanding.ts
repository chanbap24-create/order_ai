'use client';

import { useCallback, useEffect, useState } from 'react';
import type { OutstandingClient, OutstandingType } from '../types';

type Args = { currentManager: string; startDate: string; endDate: string; type: OutstandingType };

export function useOutstanding({ currentManager, startDate, endDate, type }: Args) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState<OutstandingClient[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/sales/outstanding?manager=${encodeURIComponent(currentManager)}&start_date=${startDate}&end_date=${endDate}&type=${type}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setClients(data.clients || []);
      setChecked(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [currentManager, startDate, endDate, type]);

  useEffect(() => {
    if (currentManager) fetchData();
  }, [fetchData, currentManager]);

  const allChecked = clients.length > 0 && checked.size === clients.length;

  const toggleAll = () => {
    if (allChecked) setChecked(new Set());
    else setChecked(new Set(clients.map(c => c.client_code)));
  };

  const toggleOne = (code: string) => {
    const next = new Set(checked);
    if (next.has(code)) next.delete(code); else next.add(code);
    setChecked(next);
  };

  return { loading, error, clients, checked, allChecked, toggleAll, toggleOne, fetchData };
}
