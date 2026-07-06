'use client';

import { useState } from 'react';
import type { RecSettings, GeoCeiling, FreqStrength, ScoreParams } from '../recSettings';
import { DEFAULT_SCORE_PARAMS } from '../recSettings';

type Props = {
  settings: RecSettings;
  onChange: (s: RecSettings) => void;       // 설정만 갱신(즉시 재생성 안 함)
  onReapply: (s: RecSettings) => void;      // '다시 생성' 버튼에서만 호출(서버 재조회)
  itemsCount: number;
  visibleCount: number;
  loading?: boolean;
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

export function RecControls({ settings: s, onChange, onReapply, itemsCount, visibleCount, loading }: Props) {
  const [showStock, setShowStock] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const [showSettings, setShowSettings] = useState(false); // 옵션 본문 접기
  const set = (patch: Partial<RecSettings>) => onChange({ ...s, ...patch });
  // 옵션 변경은 설정만 갱신(자동 재생성 안 함). 실제 반영은 '다시 생성' 버튼.
  const setReapply = (patch: Partial<RecSettings>) => onChange({ ...s, ...patch });
  const sp = s.scoreParams;
  const setSP = (patch: Partial<ScoreParams>) => set({ scoreParams: { ...sp, ...patch } });
  const setTier = (i: number, v: number) =>
    setSP({ tierBase: sp.tierBase.map((x, idx) => (idx === i ? v : x)) as [number, number, number, number] });

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
      {/* 옵션 변경 후 명시적으로 재생성. (추천 점수 ≥ 는 이미 받은 목록을 거르는 즉시 필터라 버튼 불필요) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderBottom: '1px solid var(--gray-200)', paddingBottom: 8, marginBottom: 2 }}>
        <button onClick={() => onReapply(s)} disabled={loading} style={{
          padding: '6px 16px', fontSize: 13, fontWeight: 700, borderRadius: 8, border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          background: loading ? 'var(--gray-300)' : 'var(--action)', color: '#fff',
        }}>{loading ? '생성 중…' : '↻ 이 설정으로 다시 생성'}</button>
        <span style={hint}>옵션을 바꾼 뒤 눌러야 반영됩니다</span>
        <button onClick={() => setShowSettings(!showSettings)} style={{
          marginLeft: 'auto', padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 999, cursor: 'pointer',
          border: '1px solid var(--gray-300)', background: '#fff', color: 'var(--text-secondary)',
        }}>⚙ 설정 {showSettings ? '닫기' : '열기'}</button>
      </div>
      {showSettings && (<>
      {/* 분석 기간 */}
      <div style={rowS}>
        <span style={lbl}>분석 기간</span>
        <input type="range" min={1} max={24} step={1} value={s.periodMonths}
          onChange={(e) => set({ periodMonths: Number(e.target.value) })}
          style={{ flex: 1, minWidth: 110, accentColor: 'var(--action)' }} />
        <input type="number" min={1} max={24} value={s.periodMonths} style={numIn}
          onChange={(e) => set({ periodMonths: Math.min(24, Math.max(1, parseInt(e.target.value, 10) || 6)) })} />
        <span style={hint}>개월 · 최근 {s.periodMonths}개월 구매 기준</span>
      </div>
      {/* 가격 밴드 */}
      <div style={rowS}>
        <span style={lbl}>가격 밴드 ±</span>
        <input type="range" min={5} max={100} step={5} value={s.priceBand}
          onChange={(e) => set({ priceBand: Number(e.target.value) })}
          style={{ flex: 1, minWidth: 110, accentColor: 'var(--action)' }} />
        <input type="number" min={5} max={100} value={s.priceBand} style={numIn}
          onChange={(e) => set({ priceBand: Math.min(100, Math.max(5, parseInt(e.target.value, 10) || 20)) })} />
        <span style={hint}>% · 평균가 ±{s.priceBand}% 이내 · {itemsCount}개</span>
      </div>
      {/* 추천 점수 허들(즉시 필터) */}
      <div style={rowS}>
        <span style={lbl}>추천 점수 ≥</span>
        <input type="range" min={0} max={100} step={5} value={s.minScore}
          onChange={(e) => set({ minScore: Number(e.target.value) })}
          style={{ flex: 1, minWidth: 110, accentColor: 'var(--action)' }} />
        <input type="number" min={0} max={100} value={s.minScore} style={numIn}
          onChange={(e) => set({ minScore: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)) })}
          disabled={s.lockCount > 0} />
        <span style={hint}>{s.lockCount > 0 ? '락 사용 중 — 허들 무시' : `점 이상 · ${visibleCount}/${itemsCount}개`}</span>
      </div>
      {/* 추천 개수 고정(락): N개로 항상 맞춤 — 초과는 점수 상위만, 부족은 다음 점수로 채움 */}
      <div style={rowS}>
        <span style={lbl}>개수 고정(락)</span>
        <input type="range" min={0} max={30} step={1} value={s.lockCount}
          onChange={(e) => set({ lockCount: Number(e.target.value) })}
          style={{ flex: 1, minWidth: 110, accentColor: 'var(--action)' }} />
        <input type="number" min={0} max={30} value={s.lockCount} style={numIn}
          onChange={(e) => set({ lockCount: Math.min(30, Math.max(0, parseInt(e.target.value, 10) || 0)) })} />
        <span style={hint}>{s.lockCount > 0 ? `${s.lockCount}개로 고정 · 현재 ${visibleCount}개` : '0=끔'}</span>
      </div>
      {/* 타입당 상한 — 기본 0(타입 분포 비율대로 자동 배분). 값 지정 시 한 타입 최대 개수 제한 */}
      <div style={rowS}>
        <span style={lbl}>타입당 상한</span>
        <input type="number" min={0} max={30} value={s.maxPerType} style={numIn}
          onChange={(e) => set({ maxPerType: Math.min(30, Math.max(0, parseInt(e.target.value, 10) || 0)) })} />
        <span style={hint}>0=비율 자동(분포대로) · 값 지정 시 타입당 최대 개수</span>
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
          style={{ flex: 1, minWidth: 110, accentColor: 'var(--action)' }} />
        <input type="number" min={0} max={12} value={s.stockMonths} style={numIn}
          onChange={(e) => set({ stockMonths: Math.min(12, Math.max(0, parseInt(e.target.value, 10) || 0)) })} />
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
                  onChange={(e) => set({ minStock: { ...s.minStock, [k]: Math.max(0, parseInt(e.target.value, 10) || 0) } })} />
              </label>
            ))}
          </div>
        )}
      </div>
      {/* 점수 가중치(고급) — 추천 정렬 점수를 직접 조절. 변경 후 '다시 생성'으로 반영. */}
      <div>
        <button onClick={() => setShowScore(!showScore)} style={{ ...hint, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
          {showScore ? '▾' : '▸'} 점수 가중치(고급)
        </button>
        {showScore && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>지역 계단 점수</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(['같은마을', '인근마을', '같은광역', '타지역'] as const).map((t, i) => (
                  <label key={t} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t}</span>
                    <input type="number" min={0} max={300} value={sp.tierBase[i]} style={{ ...numIn, width: 60 }}
                      onChange={(e) => setTier(i, Math.max(0, parseFloat(e.target.value) || 0))} />
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {([
                ['품종·향미', 'softWeight', 1, 100],
                ['견적학습±', 'quoteFeedbackWeight', 1, 100],
                ['최근제안×', 'recentPenalty', 0.05, 1],
              ] as const).map(([label, key, step, max]) => (
                <label key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</span>
                  <input type="number" min={0} max={max} step={step} value={sp[key]} style={{ ...numIn, width: 66 }}
                    onChange={(e) => setSP({ [key]: Math.min(max, Math.max(0, parseFloat(e.target.value) || 0)) } as Partial<ScoreParams>)} />
                </label>
              ))}
            </div>
            <button onClick={() => setReapply({ scoreParams: { ...DEFAULT_SCORE_PARAMS } })}
              style={{ ...hint, alignSelf: 'flex-start', background: 'none', border: '1px solid var(--gray-300)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
              기본값으로 초기화
            </button>
          </div>
        )}
      </div>
      </>)}
    </div>
  );
}
