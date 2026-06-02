'use client';

import { useEffect, useState } from 'react';

export interface UnsetClient { client_code: string; client_name: string; type: 'wine' | 'glass'; }

// 담당자의 결제조건 미설정 거래처(와인+글라스, 신규 포함). 서버에서 필터되어 미설정만 받음.
export function usePaymentTermsUnset(manager: string) {
  const [clients, setClients] = useState<UnsetClient[]>([]);

  useEffect(() => {
    if (!manager) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/sales/payment-terms/unset?manager=${encodeURIComponent(manager)}`);
        const j = await res.json();
        if (!cancelled) setClients(Array.isArray(j.clients) ? j.clients : []);
      } catch { if (!cancelled) setClients([]); }
    })();
    return () => { cancelled = true; };
  }, [manager]);

  return clients;
}
