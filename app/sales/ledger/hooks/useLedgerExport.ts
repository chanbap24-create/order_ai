'use client';

import { useState } from 'react';
import type { ClientInfo, LedgerType, SuggestionItem } from '../types';

type Args = {
  selectedClient: SuggestionItem | null;
  client: ClientInfo | null;
  startDate: string;
  endDate: string;
  type: LedgerType;
};

export function useLedgerExport({ selectedClient, client, startDate, endDate, type }: Args) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: 'excel' | 'pdf') => {
    if (!selectedClient || exporting) return;
    setExporting(true);
    try {
      const params = new URLSearchParams({
        client_code: selectedClient.code,
        start_date: startDate,
        end_date: endDate,
        type,
        format,
      });
      const res = await fetch(`/api/sales/ledger/export?${params}`);
      if (!res.ok) throw new Error('다운로드 실패');
      const blob = await res.blob();
      const safeName = (client?.client_name || selectedClient.code).replace(/[\\/:*?"<>|]/g, '_');
      const ext = format === 'pdf' ? 'pdf' : 'xlsx';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const prefix = type === 'glass' ? '대유라이프' : '까브드뱅';
      a.download = `${prefix}_매출처원장_${safeName}_${startDate.slice(0, 7)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
    } catch {
      alert('다운로드 중 오류가 발생했습니다.');
    } finally {
      setExporting(false);
    }
  };

  return { exporting, handleExport };
}
