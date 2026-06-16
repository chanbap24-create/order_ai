'use client';

import { useEffect, useState } from 'react';
import type { ClientOption, ScoredItem } from '../types';

type Args = {
  quoteCols: string[];
  selectedClient: ClientOption | null;
  manager?: string;        // 견적 항목 매니저 스코프 (편집 패널과 일치시키기 위함)
  onAdded?: () => void;    // 담기 성공 시 호출 (하단 편집 패널 새로고침)
};

export function useQuoteExport({ quoteCols, selectedClient, manager, onAdded }: Args) {
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteResult, setQuoteResult] = useState<string | null>(null);

  useEffect(() => {
    if (!quoteResult) return;
    const t = setTimeout(() => setQuoteResult(null), 3000);
    return () => clearTimeout(t);
  }, [quoteResult]);

  const createQuote = async (items: ScoredItem[], mode: 'download' | 'add') => {
    if (items.length === 0) return;
    setQuoteLoading(true);
    setQuoteResult(null);
    try {
      const res = await fetch('/api/sales/recommend/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          client_code: selectedClient?.client_code,
          client_name: selectedClient?.client_name,
          manager: manager || '',
          clear_existing: mode === 'download',
        }),
      });
      const json = await res.json();
      if (json.error) { setQuoteResult(`오류: ${json.error}`); return; }

      onAdded?.(); // 하단 편집 패널 새로고침

      if (mode === 'download') {
        const params = new URLSearchParams();
        params.set('columns', JSON.stringify(quoteCols));
        if (manager) params.set('manager', manager);
        if (selectedClient?.client_name) params.set('client_name', selectedClient.client_name);
        window.location.href = `/api/quote/export?${params}`;
        setQuoteResult(`${json.added_count}개 와인 견적서 생성 완료`);
      } else {
        setQuoteResult(`${json.added_count}개 와인을 아래 견적 편집 패널에 담았습니다.`);
      }
    } catch {
      setQuoteResult('견적서 생성에 실패했습니다.');
    } finally {
      setQuoteLoading(false);
    }
  };

  return { quoteLoading, quoteResult, createQuote };
}
