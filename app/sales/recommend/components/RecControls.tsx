'use client';

import { useState } from 'react';
import type { RecSettings, GeoCeiling, FreqStrength } from '../recSettings';

type Props = {
  settings: RecSettings;
  onChange: (s: RecSettings) => void;       // 즉시 반영(클라이언트 필터: 추천점수)
  onReapply: (s: RecSettings) => void;      // 서버 재조회 필요한 변경
  itemsCount: number;
  visibleCount: number;
};

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid var(--action-muted)', borderRadius: 10,
  padding: '10px 14px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8,
};
const rowS: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' };
const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', minWidth: 78 };
const numIn: React.CSSProperties = { width: 56, padding: '3px 6px', fontSize: 13, textAlign: 'center', border: '1px solid var(--gray-300)', borderRadius: 6, color: 'var(--text-primary)' };
const hint: React.CSSProperties = { fontSize: 12, color: 'var(--text-tertiary)' };

const GEO_OPTS: { v: GeoCeiling; t: string }[] = [
  { v: 'super', t: '광역까지' }, { v: 'country', t: '같은 국가까지' }, { v: 'any', t: '제한없음' },
];
const FREQ_OPTS: { v: FreqStrength; t: string }[] = [
  { v: 'strong', t: '강하게' }, { v: 'soft', t: '약하게' }, { v: 'off', t: '끔' },
];
const STOCK_TIERS: { k: keyof RecSettings['minStock']; t: string }[] = [
  { k: 'price_300k', t: '30만↑' }, { k: 'price_200k', t: '20만↑' }, { k: 'price_100k', t: '10만↑' },
  { k: 'price_50k', t: '5만↑' }, { k: 'price_20k', t: '2만↑' }, { k: 'price_under_20k', t: '2만↓' },
];

export function RecControls({ settings: s, onChange, onReapply, itemsCount, visibleCount }: Props) {
  const [showStock, setShowStock] = useState(false);
  const set = (patch: Partial<RecSettings>) => onChange({ ...s, ...patch });
  const setReapply = (patch: Partial<RecSettings>) => { const next = { ...s, ...patch }; onChange(next); onReapply(next); };

  const btnGroup = <T,>(opts: { v: T; t: string }[], cur: T, pick: (v: T) => void) => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {opts.map((o) => (
        <button key={String(o.v)} onClick={() => pick(o.v)} style={{
          padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 999, cursor: 'pointer',
          border: '1px solid ' + (cur === o.v ? 'var(--action)' : 'var(--gray-300)'),
          background: cur === o.v ? 'var(--action)' : '#fff', color: cur === o.v ? '#fff' : 'var(--text-tertiary)',
        }}>{o.t}</button>
      ))}
    </div>
  );

  return (
    <div style={card}>
      {/* 분석 기간 */}
      <div style={rowS}>
        <span style={lbl}>분석 기간</span>
        <input type="range" min={1} max={24} step={1} value={s.periodMonths}
          onChange={(e) => set({ periodMonths: Number(e.target.value) })}
          onMouseUp={() => onReapply(s)} onTouchEnd={() => onReapply(s)}
          style={{ flex: 1, minWidth: 110, accentColor: 'var(--action)' }} />
        <input type="number" min={1} max={24} value={s.periodMonths} style={numIn}
          onChange={(e) => set({ periodMonths: Math.min(24, Math.max(1, parseInt(e.target.value, 10) || 6)) })}
          onBlur={() => onReapply(s)} />
        <span style={hint}>개월 · 최근 {s.periodMonths}개월 구매 기준</span>
      </div>
      {/* 가격 밴드 */}
      <div style={rowS}>
        <span style={lbl}>가격 밴드 ±</span>
        <input type="range" min={5} max={100} step={5} value={s.priceBand}
          onChange={(e) => set({ priceBand: Number(e.target.value) })}
          onMouseUp={() => onReapply(s)} onTouchEnd={() => onReapply(s)}
          style={{ flex: 1, minWidth: 110, accentColor: 'var(--action)' }} />
        <input type="number" min={5} max={100} value={s.priceBand} style={numIn}
          onChange={(e) => set({ priceBand: Math.min(100, Math.max(5, parseInt(e.target.value, 10) || 20)) })}
          onBlur={() => onReapply(s)} />
        <span style={hint}>% · 평균가 ±{s.priceBand}% 이내 · {itemsCount}개</span>
      </div>
      {/* 추천 점수 허들(즉시 필터) */}
      <div style={rowS}>
        <span style={lbl}>추천 점수 ≥</span>
        <input type="range" min={0} max={100} step={5} value={s.minScore}
          onChange={(e) => set({ minScore: Number(e.target.value) })}
          style={{ flex: 1, minWidth: 110, accentColor: 'var(--action)' }} />
        <input type="number" min={0} max={100} value={s.minScore} style={numIn}
          onChange={(e) => set({ minScore: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)) })} />
        <span style={hint}>점 이상 · {visibleCount}/{itemsCount}개</span>
      </div>
      {/* 지역 확장 범위 */}
      <div style={rowS}>
        <span style={lbl}>지역 확장</span>
        {btnGroup(GEO_OPTS, s.geoCeiling, (v) => setReapply({ geoCeiling: v }))}
        <span style={hint}>광역 밖을 어디까지 추천할지</span>
      </div>
      {/* 입고빈도 반영 강도 */}
      <div style={rowS}>
        <span style={lbl}>입고빈도</span>
        {btnGroup(FREQ_OPTS, s.freqStrength, (v) => setReapply({ freqStrength: v }))}
        <span style={hint}>자주 산 지역 우대 강도</span>
      </div>
      {/* 재고 여유분 */}
      <div style={rowS}>
        <span style={lbl}>재고 여유분</span>
        <input type="range" min={0} max={6} step={1} value={s.stockMonths}
          onChange={(e) => set({ stockMonths: Number(e.target.value) })}
          onMouseUp={() => onReapply(s)} onTouchEnd={() => onReapply(s)}
          style={{ flex: 1, minWidth: 110, accentColor: 'var(--action)' }} />
        <input type="number" min={0} max={12} value={s.stockMonths} style={numIn}
          onChange={(e) => set({ stockMonths: Math.min(12, Math.max(0, parseInt(e.target.value, 10) || 0)) })}
          onBlur={() => onReapply(s)} />
        <span style={hint}>개월치 이상 재고만 추천</span>
      </div>
      {/* 가격대별 최소재고(고급) */}
      <div>
        <button onClick={() => setShowStock(!showStock)} style={{ ...hint, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
          {showStock ? '▾' : '▸'} 가격대별 최소재고(병)
        </button>
        {showStock && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            {STOCK_TIERS.map(({ k, t }) => (
              <label key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t}</span>
                <input type="number" min={0} value={s.minStock[k]} style={{ ...numIn, width: 60 }}
                  onChange={(e) => set({ minStock: { ...s.minStock, [k]: Math.max(0, parseInt(e.target.value, 10) || 0) } })}
                  onBlur={() => onReapply(s)} />
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
