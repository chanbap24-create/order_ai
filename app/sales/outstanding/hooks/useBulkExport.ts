'use client';

import { useState } from 'react';
import type { OutstandingType } from '../types';

type Args = {
  checked: Set<string>;
  startDate: string;
  endDate: string;
  type: OutstandingType;
};

export function useBulkExport({ checked, startDate, endDate, type }: Args) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: 'excel' | 'pdf' = 'excel') => {
    if (checked.size === 0) return;
    setExporting(true);
    try {
      const res = await fetch('/api/sales/outstanding/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_codes: Array.from(checked),
          start_date: startDate,
          end_date: endDate,
          type,
          format,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '다운로드 실패');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const prefix = type === 'glass' ? '대유라이프' : '까브드뱅';
      a.download = `${prefix}_매출처원장_일괄_${startDate.slice(0, 7)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : '다운로드 실패');
    } finally {
      setExporting(false);
    }
  };

  return { exporting, handleExport };
}
