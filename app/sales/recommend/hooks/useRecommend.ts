'use client';

import { useState } from 'react';
import type { ClientOption, RecommendResult } from '../types';

export function useRecommend() {
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async (client: ClientOption) => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/sales/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_code: client.client_code }),
      });
      const json = await res.json();
      if (json.error) setError(json.error);
      else setResult(json);
    } catch {
      setError('추천 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return { result, loading, error, generate, setResult };
}
