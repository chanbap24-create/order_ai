'use client';

import { useState } from 'react';
import type { ClientOption, RecommendResult } from '../types';
import type { RecSettings } from '../recSettings';

export type RecommendQuoteResult = RecommendResult & { comment?: string; model?: string };

/** 추천 견적(순수 규칙): /api/sales/recommend 호출. 영업사원 설정(RecSettings) 전달. */
export function useRecommendQuote() {
  const [result, setResult] = useState<RecommendQuoteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async (
    client: ClientOption,
    s: RecSettings,
    anchor?: { item_code: string; price?: number } | null,
  ) => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/sales/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_code: client.client_code,
          price_band: s.priceBand / 100,
          profile_months: s.periodMonths,
          geo_ceiling: s.geoCeiling,
          freq_strength: s.freqStrength,
          stock_months: s.stockMonths,
          min_stock: s.minStock,
          score_params: s.scoreParams,
          popularity_weight: (s.popularityWeight || 0) / 100,
          mode: s.mode,
          include_nonstandard: s.includeNonStandard,
          discount_apply: s.discountApply,
          discount_scope: s.discountScope,
          ...(s.mode === 'substitute' && anchor
            ? { anchor_item_code: anchor.item_code, anchor_price: anchor.price }
            : {}),
          ...(s.mode === 'discovery'
            ? {
                discovery_types: s.discoveryTypes,
                discovery_min_price: s.discoveryMinPrice,
                discovery_max_price: s.discoveryMaxPrice,
                discovery_segment: s.discoverySegment,
              }
            : {}),
        }),
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
