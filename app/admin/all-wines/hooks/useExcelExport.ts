'use client';

import { useState } from 'react';

export function useExcelExport() {
  const [exporting, setExporting] = useState(false);

  const exportExcel = async ({ search, country, hideZero }: { search: string; country: string; hideZero: boolean }) => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (country) params.set('country', country);
      if (hideZero) params.set('hideZero', '1');
      const res = await fetch(`/api/admin/wines/export?${params}`);
      if (!res.ok) throw new Error('다운로드 실패');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wine-list_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('엑셀 다운로드에 실패했습니다.');
    } finally {
      setExporting(false);
    }
  };

  return { exporting, exportExcel };
}
