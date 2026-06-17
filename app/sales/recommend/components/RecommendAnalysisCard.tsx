'use client';

import type { RecommendResult } from '../types';

/** 추천 근거 카드 — 거래처 취향 프로파일 + 적용된 규칙을 설명. */
export function RecommendAnalysisCard({ summary }: { summary: RecommendResult['summary'] }) {
  const a = summary.analysis;
  if (!a) return null;
  const won = (n: number) => (n ? `${n.toLocaleString()}원` : '-');
  const lo = a.avg_price ? Math.round((a.avg_price * (100 - a.band_pct)) / 100) : 0;
  const hi = a.avg_price ? Math.round((a.avg_price * (100 + a.band_pct)) / 100) : 0;

  const chips = (items: string[]) => items.map((t, i) => (
    <span key={i} style={{
      fontSize: 12, fontWeight: 600, color: 'var(--action)', background: '#fff',
      border: '1px solid var(--action-muted)', borderRadius: 999, padding: '2px 10px',
    }}>{t}</span>
  ));
  const row = (label: string, items?: string[]) =>
    items && items.length > 0 ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', minWidth: 92 }}>{label}</span>
        {chips(items)}
      </div>
    ) : null;

  return (
    <div style={{
      background: '#fff', border: '1px solid var(--action-muted)', borderRadius: 10,
      padding: '14px 16px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>📊 추천 근거 (거래처 분석)</div>
      {row('주력 타입', a.types)}
      {row('주력 산지(광역)', a.broad_regions)}
      {row('주력 마을', summary.top_regions)}
      {row('향미', a.flavors)}

      {a.region_dist && a.region_dist.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>지역별 매입 분포 (최근 출고 기준)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {a.region_dist.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-primary)', minWidth: 120, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label}</span>
                <div style={{ flex: 1, background: 'var(--gray-100)', borderRadius: 4, height: 14, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(d.pct, 2)}%`, height: '100%', background: 'var(--action)', borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 64, whiteSpace: 'nowrap' }}>{d.pct}% · {d.count}건</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
        평균가 <b style={{ color: 'var(--text-primary)' }}>{won(a.avg_price)}</b>
        {' · '}허용 가격대 <b style={{ color: 'var(--text-primary)' }}>{won(lo)}~{won(hi)}</b> (±{a.band_pct}%)
      </div>
      <div style={{
        fontSize: 12, lineHeight: 1.6, color: 'var(--neutral-600)',
        borderTop: '1px dashed var(--gray-200)', paddingTop: 8,
      }}>
        이 거래처가 주로 사는 <b>타입·가격대·산지</b>에 맞춰
        <b> 같은 마을 → 인근 마을 → 같은 광역</b> 순으로 추천했습니다.
        타입이 다르거나, 평균가 ±{a.band_pct}% 밖이거나, 다른 광역(타국 포함)인 와인은 제외됩니다.
      </div>
    </div>
  );
}
