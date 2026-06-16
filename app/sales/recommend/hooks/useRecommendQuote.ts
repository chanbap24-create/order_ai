'use client';

import { useState } from 'react';
import type { ClientOption, RecommendResult } from '../types';

export type RecommendQuoteResult = RecommendResult & { comment?: string; model?: string };

/** 추천 견적(하이브리드): /api/sales/recommend/llm-quote 호출. comment 포함. */
export function useRecommendQuote() {
  const [result, setResult] = useState<RecommendQuoteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async (client: ClientOption) => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/sales/recommend/llm-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_code: client.client_code }),
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
