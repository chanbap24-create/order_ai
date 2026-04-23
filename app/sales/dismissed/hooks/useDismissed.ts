'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DismissedItem } from '../types';

export function useDismissed() {
  const [items, setItems] = useState<DismissedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [restoring, setRestoring] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadDismissed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sales/alerts');
      const data = await res.json();
      setItems(data.items || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadDismissed(); }, [loadDismissed]);

  const toggleCheck = (itemNo: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(itemNo)) next.delete(itemNo); else next.add(itemNo);
      return next;
    });
  };

  const toggleAllFor = (filtered: DismissedItem[]) => {
    const allChecked = filtered.length > 0 && filtered.every(i => checked.has(i.item_no));
    if (allChecked) setChecked(new Set());
    else setChecked(new Set(filtered.map(i => i.item_no)));
  };

  const handleRestore = async () => {
    if (checked.size === 0) return;
    setRestoring(true);
    try {
      const res = await fetch('/api/sales/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_nos: Array.from(checked), action: 'restore' }),
      });
      const data = await res.json();
      if (data.success) {
        setItems(prev => prev.filter(i => !checked.has(i.item_no)));
        setToast(`${checked.size}개 와인이 복구되었습니다.`);
        setChecked(new Set());
        setTimeout(() => setToast(null), 3000);
      }
    } catch { /* ignore */ }
    finally { setRestoring(false); }
  };

  return {
    items, loading, checked, restoring, toast,
    toggleCheck, toggleAllFor, handleRestore,
  };
}
