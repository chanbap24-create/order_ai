'use client';

import { useEffect, useState } from 'react';

export interface SuggestedClient { client_code: string; client_name: string }

/**
 * 발주 텍스트 → 거래처 추천 칩.
 * 거래처 미선택 + 텍스트 10자 이상일 때만 디바운스(700ms) 조회.
 * 선택되면 즉시 비움 (칩 숨김).
 */
export function useClientSuggest(orderText: string, hasSelected: boolean, tab: string) {
  const [suggestions, setSuggestions] = useState<SuggestedClient[]>([]);

  useEffect(() => {
    if (hasSelected || orderText.trim().length < 10) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      const params = new URLSearchParams({ text: orderText.slice(0, 2000), tab });
      fetch(`/api/order-v2/client-suggest?${params}`, { headers: { 'X-Track-Skip': '1' } })
        .then((r) => r.json())
        .then((d) => setSuggestions(Array.isArray(d.clients) ? d.clients : []))
        .catch(() => setSuggestions([]));
    }, 700);
    return () => clearTimeout(t);
  }, [orderText, hasSelected, tab]);

  return suggestions;
}
