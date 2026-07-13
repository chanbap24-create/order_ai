'use client';

import type { RecommendResult } from '../types';
import { IMPORTANCE_LABELS } from '../constants';
import { fmt } from '../lib/format';

// 거래처 등급(0~4) 뱃지 배경 — 높을수록 강조(취향·산지 반영↑).
const GRADE_BG = [
  'rgba(255,255,255,0.16)', // 0
  'rgba(255,255,255,0.24)', // 1
  'rgba(80,200,160,0.38)',  // 2
  'rgba(80,200,160,0.55)',  // 3
  'rgba(255,205,70,0.6)',   // 4
];

export function SummaryCard({ result }: { result: RecommendResult }) {
  const { grade, riedel, winback } = result.client;
  return (
    <div style={{
      background: 'var(--action)',
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
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {typeof grade === 'number' && (
            <span
              title="거래처 등급(직전 분기 거래량 기반) — 높을수록 추천에 산지·취향·견적학습 반영↑"
              style={{ padding: '4px 10px', borderRadius: 12, background: GRADE_BG[grade] ?? GRADE_BG[0], fontSize: 12, fontWeight: 700 }}
            >
              {grade}등급
            </span>
          )}
          {winback && (
            <span
              title={`발주 리듬이 끊긴 거래처(${winback === 'dormant' ? '휴면' : '이탈위험'}) — 윈백 가산이 할인율에 자동 합산됨`}
              style={{
                padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                background: 'rgba(255,120,90,0.45)',
              }}
            >
              윈백가 적용
            </span>
          )}
          {riedel !== undefined && (
            <span
              title={riedel ? '직전 1년 리델 거래 있음 — 추천견적 +5% 추가할인 적용' : '직전 1년 리델 거래 없음 — 추가할인 미적용'}
              style={{
                padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                background: riedel ? 'rgba(255,205,70,0.35)' : 'rgba(255,255,255,0.12)',
                opacity: riedel ? 1 : 0.7,
              }}
            >
              {riedel ? '🥂 리델 사용' : '리델 미사용'}
            </span>
          )}
          <span style={{ padding: '4px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
            {IMPORTANCE_LABELS[result.client.importance]?.label || '일반'}
          </span>
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
            <span key={t} style={{ padding: '2px 8px', borderRadius: 12, background: 'rgba(0,137,123,0.3)', fontSize: 11 }}>
              {t}
            </span>
          ))}
          {result.summary.top_countries.map(c => (
            <span key={c} style={{ padding: '2px 8px', borderRadius: 12, background: 'rgba(255,255,255,0.15)', fontSize: 11 }}>
              {c}
            </span>
          ))}
          {result.summary.top_grapes.map(g => (
            <span key={g} style={{ padding: '2px 8px', borderRadius: 12, background: 'rgba(255,255,255,0.1)', fontSize: 11 }}>
              {g}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
