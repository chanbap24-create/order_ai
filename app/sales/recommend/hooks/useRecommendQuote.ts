'use client';

import { useState } from 'react';
import type { ClientOption, RecommendResult } from '../types';

export type RecommendQuoteResult = RecommendResult & { comment?: string; model?: string };

/** 추천 견적(순수 규칙): /api/sales/recommend 호출. priceBand = ±비율(0.2=±20%). */
export function useRecommendQuote() {
  const [result, setResult] = useState<RecommendQuoteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async (client: ClientOption, priceBand = 0.2) => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/sales/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_code: client.client_code, price_band: priceBand }),
      });
      const json = await res.json();
      if (json.error) setError(json.error);
      else setResult(json);
    } catch {
      setError('추천 견적 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return { result, loading, error, generate, setResult };
}
