'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AlertCounts, AlertItem, AlertsResponse } from '../types';

type Args = {
  selectedManager: string;
  onCountChange?: (count: number) => void;
};

export function useAlerts({ selectedManager, onCountChange }: Args) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [scanning, setScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [counts, setCounts] = useState<AlertCounts>({ total: 0, low: 0, out: 0 });
  const [dismissMsg, setDismissMsg] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
    if (!selectedManager) return;
    setScanning(true);
    try {
      const res = await fetch('/api/sales/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager: selectedManager }),
      });
      const data: AlertsResponse = await res.json();
      setAlerts(data.alerts || []);
      setCounts({ total: data.total, low: data.low_stock_count, out: data.out_of_stock_count });
      if (data.scanned_at) setLastScanned(data.scanned_at);
      onCountChange?.(data.total);
      if (data.auto_restored > 0) {
        setDismissMsg(`재입고 감지: ${data.auto_restored}개 품목이 자동 복원되었습니다.`);
        setTimeout(() => setDismissMsg(null), 4000);
      }
    } catch { /* ignore */ }
    finally {
      setScanning(false);
    }
  }, [selectedManager, onCountChange]);

  const prevManager = useRef('');
  useEffect(() => {
    if (selectedManager && selectedManager !== prevManager.current) {
      prevManager.current = selectedManager;
      handleScan();
    }
  }, [selectedManager, handleScan]);

  const handleDismiss = useCallback(async (checked: Set<string>) => {
    if (checked.size === 0) return false;
    const itemNos = Array.from(checked);
    const items = alerts
      .filter(a => checked.has(a.item_no))
      .map(a => ({ item_no: a.item_no, item_name: a.item_name }));
    try {
      const res = await fetch('/api/sales/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_nos: itemNos, action: 'dismiss', items }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setDismissMsg(`제외 실패: ${data.error || '서버 오류'}`);
        setTimeout(() => setDismissMsg(null), 3000);
        return false;
      }
      setAlerts(prev => prev.filter(a => !checked.has(a.item_no)));
      const newTotal = alerts.length - checked.size;
      setCounts(prev => ({
        total: newTotal,
        low: prev.low - alerts.filter(a => checked.has(a.item_no) && a.alert_type === 'low_stock').length,
        out: prev.out - alerts.filter(a => checked.has(a.item_no) && a.alert_type === 'out_of_stock').length,
      }));
      onCountChange?.(newTotal);
      setDismissMsg(`${checked.size}개 와인이 제외되었습니다.`);
      setTimeout(() => setDismissMsg(null), 3000);
      return true;
    } catch (err) {
      console.error('Dismiss error:', err);
      setDismissMsg('제외 처리 중 오류가 발생했습니다.');
      setTimeout(() => setDismissMsg(null), 3000);
      return false;
    }
  }, [alerts, onCountChange]);

  return {
    alerts, scanning, lastScanned, counts, dismissMsg,
    handleScan, handleDismiss,
  };
}
