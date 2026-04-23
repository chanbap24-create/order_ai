'use client';

import { useCallback, useState } from 'react';
import type { AnalysisType, ClientDetailItem } from '../types';

type SelectedClient = { code: string; name: string } | null;

export function useClientDetailSheet(type: AnalysisType, startDate: string, endDate: string) {
  const [selectedClient, setSelectedClient] = useState<SelectedClient>(null);
  const [clientItems, setClientItems] = useState<ClientDetailItem[]>([]);
  const [loading, setLoading] = useState(false);

  const open = useCallback(async (code: string, name: string) => {
    setSelectedClient({ code, name });
    setLoading(true);
    setClientItems([]);
    try {
      const params = new URLSearchParams({ type, clientCode: code });
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await fetch(`/api/admin/client-analysis?${params}`);
      const json = await res.json();
      if (json.success) setClientItems(json.clientItems || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [type, startDate, endDate]);

  const close = useCallback(() => setSelectedClient(null), []);

  return { selectedClient, clientItems, loading, open, close };
}
