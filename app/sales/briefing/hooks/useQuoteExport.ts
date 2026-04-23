'use client';

import { useState } from 'react';
import type { BriefingData, Meeting } from '../types';

type Args = {
  quoteCols: string[];
  onToast: (msg: string) => void;
};

export function useQuoteExport({ quoteCols, onToast }: Args) {
  const [quoteLoadingId, setQuoteLoadingId] = useState<number | null>(null);

  const createQuoteFromBriefing = async (meeting: Meeting, briefing: BriefingData) => {
    if (briefing.recommendations.length === 0) return;
    setQuoteLoadingId(meeting.id);
    try {
      const items = briefing.recommendations.slice(0, 5);
      const res = await fetch('/api/sales/recommend/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          client_code: meeting.client_code,
          client_name: meeting.client_name,
          clear_existing: true,
        }),
      });
      const json = await res.json();
      if (json.error) {
        onToast('오류: ' + json.error);
        return;
      }
      const params = new URLSearchParams();
      params.set('columns', JSON.stringify(quoteCols));
      if (meeting.client_name) params.set('client_name', meeting.client_name);
      window.location.href = `/api/quote/export?${params}`;
      onToast(`${json.added_count}개 와인 견적서 생성 완료`);
    } catch {
      onToast('견적서 생성에 실패했습니다.');
    } finally {
      setQuoteLoadingId(null);
    }
  };

  return { quoteLoadingId, createQuoteFromBriefing };
}
