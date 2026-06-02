'use client';

import { useEffect, useState } from 'react';

export interface UnsetClient { client_code: string; client_name: string; type: 'wine' | 'glass'; }
type Row = { client_code: string; client_name: string; payment_type: string | null };

// 담당자의 결제조건 미설정 거래처(와인+글라스) — 신규 거래처 포함. 알림 탭 배너용.
export function usePaymentTermsUnset(manager: string) {
  const [clients, setClients] = useState<UnsetClient[]>([]);

  useEffect(() => {
    if (!manager) return;
    let cancelled = false;
    (async () => {
      try {
        const q = (t: string) => fetch(`/api/sales/payment-terms?manager=${encodeURIComponent(manager)}&type=${t}`)
          .then(r => r.json()).catch(() => ({ clients: [] }));
        const [w, g] = await Promise.all([q('wine'), q('glass')]);
        if (cancelled) return;
        const pick = (rows: Row[] | undefined, type: 'wine' | 'glass'): UnsetClient[] =>
          (rows || []).filter(c => !c.payment_type).map(c => ({ client_code: c.client_code, client_name: c.client_name, type }));
        setClients([...pick(w.clients, 'wine'), ...pick(g.clients, 'glass')]);
      } catch { if (!cancelled) setClients([]); }
    })();
    return () => { cancelled = true; };
  }, [manager]);

  return clients;
}
