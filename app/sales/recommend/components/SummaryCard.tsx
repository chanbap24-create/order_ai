'use client';

import type { RecommendResult } from '../types';
import { IMPORTANCE_LABELS } from '../constants';
import { fmt } from '../lib/format';

export function SummaryCard({ result }: { result: RecommendResult }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #5A1515, #8B2252)',
      borderRadius: 12, padding: '16px', marginBottom: 16, color: '#fff',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{result.client.name}</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {result.client.business_type || '업종 미설정'}
            {result.client.manager && ` · ${result.client.manager}`}
          </div>
        </div>
        <div style={{ padding: '4px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
          {IMPORTANCE_LABELS[result.client.importance]?.label || '일반'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
        <div>
          <div style={{ opacity: 0.7 }}>구매 품목</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{result.summary.total_items}종</div>
        </div>
        <div>
          <div style={{ opacity: 0.7 }}>평균 구매가</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(result.summary.avg_price)}원</div>
        </div>
        <div>
          <div style={{ opacity: 0.7 }}>최근 주문</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{result.summary.last_order_date || '-'}</div>
        </div>
      </div>
      {(
        result.summary.top_countries.length > 0 ||
        result.summary.top_grapes.length > 0 ||
        (result.summary.top_types || []).length > 0
      ) && (
        <div style={{ marginTop: 10, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(result.summary.top_types || []).map(t => (
            <span key={t} style={{ padding: '2px 8px', borderRadius: 10, background: 'rgba(0,137,123,0.3)', fontSize: 11 }}>
              {t}
            </span>
          ))}
          {result.summary.top_countries.map(c => (
            <span key={c} style={{ padding: '2px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.15)', fontSize: 11 }}>
              {c}
            </span>
          ))}
          {result.summary.top_grapes.map(g => (
            <span key={g} style={{ padding: '2px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.1)', fontSize: 11 }}>
              {g}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
