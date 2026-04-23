'use client';

import { useEffect, useState } from 'react';
import type { ShipmentsData } from '../types';

const EMPTY: ShipmentsData = { clients: [], totals: { supply: 0, tax: 0, total: 0 }, count: 0 };

export function useTodayShipments(currentManager: string, isAdmin: boolean) {
  const [wineShipments, setWineShipments] = useState<ShipmentsData | null>(null);
  const [glassShipments, setGlassShipments] = useState<ShipmentsData | null>(null);

  useEffect(() => {
    if (!currentManager) return;
    (async () => {
      try {
        const params = new URLSearchParams();
        if (!isAdmin) params.set('manager', currentManager);
        const res = await fetch(`/api/sales/shipments/today?${params}`);
        const json = await res.json();
        const w: ShipmentsData = json.wine || EMPTY;
        const g: ShipmentsData = json.glass || EMPTY;
        setWineShipments(w.count > 0 ? w : null);
        setGlassShipments(g.count > 0 ? g : null);
      } catch (e) {
        console.error('[shipments/today] error', e);
      }
    })();
  }, [isAdmin, currentManager]);

  return { wineShipments, glassShipments };
}
