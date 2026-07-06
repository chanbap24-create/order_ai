'use client';

import { useEffect, useState } from 'react';
import type { RecMode } from '../recSettings';

export type AnchorItem = {
  item_code: string;
  name: string;
  price: number;
  region: string;
  wine_type: string;
  count: number;
  last: string;
};

type DiscoveryState = { types: string[]; minPrice: number; maxPrice: number; segment: string };
type DiscoveryPatch = Partial<{ discoveryTypes: string[]; discoveryMinPrice: number; discoveryMaxPrice: number; discoverySegment: string }>;

type Props = {
  clientCode: string | null;
  mode: RecMode;
  onModeChange: (m: RecMode) => void;
  anchor: AnchorItem | null;
  onAnchorChange: (a: AnchorItem | null) => void;
  discovery: DiscoveryState;
  onDiscoveryChange: (patch: DiscoveryPatch) => void;
  onGenerate: () => void;
  loading: boolean;
};

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid var(--action-muted)', borderRadius: 10,
  padding: '12px 14px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10,
};
const hint: React.CSSProperties = { fontSize: 12, color: 'var(--text-tertiary)' };
const numIn: React.CSSProperties = { width: 90, padding: '5px 8px', fontSize: 13, border: '1px solid var(--gray-300)', borderRadius: 6, color: 'var(--text-primary)' };
const genBtn = (on: boolean): React.CSSProperties => ({
  alignSelf: 'flex-start', padding: '7px 16px', fontSize: 13, fontWeight: 700, borderRadius: 8,
  border: 'none', cursor: on ? 'pointer' : 'not-allowed',
  background: on ? 'var(--action)' : 'var(--gray-300)', color: '#fff',
});

const MODE_OPTS: { v: RecMode; t: string; d: string }[] = [
  { v: 'new', t: '신규 제안', d: '거래처 취향 기반 · 지역 넓게' },
  { v: 'substitute', t: '대체 상품', d: '쇼트난 상품의 지역·가격에 근접' },
  { v: 'discovery', t: '발굴 / 신규', d: '이력 무관 · 베스트셀러+업태' },
];
const TYPE_CHIPS: [string, string][] = [
  ['sparkling', '스파클링'], ['white', '화이트'], ['red', '레드'], ['rose', '로제'], ['fortified', '주정강화'], ['sweet', '스위트'],
];

export function RecModeSelector({ clientCode, mode, onModeChange, anchor, onAnchorChange, discovery, onDiscoveryChange, onGenerate, loading }: Props) {
  const [purchases, setPurchases] = useState<AnchorItem[]>([]);
  const [pLoading, setPLoading] = useState(false);
  const [q, setQ] = useState('');
  const [segments, setSegments] = useState<{ name: string; count: number }[]>([]);

  // 대체상품 모드 + 거래처 선택 시 구매이력 로드 (비-substitute 모드에선 리스트 미렌더라 초기화 불필요)
  useEffect(() => {
    if (mode !== 'substitute' || !clientCode) return;
    let cancelled = false;
    const run = async () => {
      setPLoading(true);
      try {
        const j = await (await fetch(`/api/sales/recommend/purchases?client_code=${encodeURIComponent(clientCode)}`)).json();
        if (!cancelled) setPurchases(Array.isArray(j.items) ? j.items : []);
      } catch {
        if (!cancelled) setPurchases([]);
      } finally {
        if (!cancelled) setPLoading(false);
      }
    };
    const id = setTimeout(run, 0);
    return () => { cancelled = true; clearTimeout(id); };
  }, [mode, clientCode]);

  // 발굴 모드: 업태 목록 로드
  useEffect(() => {
    if (mode !== 'discovery' || segments.length) return;
    let cancelled = false;
    const run = async () => {
      try {
        const j = await (await fetch('/api/sales/recommend/segments')).json();
        if (!cancelled) setSegments(Array.isArray(j.segments) ? j.segments : []);
      } catch { /* 무시 */ }
    };
    const id = setTimeout(run, 0);
    return () => { cancelled = true; clearTimeout(id); };
  }, [mode, segments.length]);

  const filtered = q.trim()
    ? purchases.filter((p) => `${p.name} ${p.item_code} ${p.region}`.toLowerCase().includes(q.trim().toLowerCase()))
    : purchases;

  const toggleType = (key: string) => {
    const set = new Set(discovery.types);
    if (set.has(key)) set.delete(key); else set.add(key);
    onDiscoveryChange({ discoveryTypes: [...set] });
  };

  return (
    <div style={card}>
      {/* 추천 타입 토글 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {MODE_OPTS.map((o) => {
          const on = mode === o.v;
          return (
            <button key={o.v} onClick={() => onModeChange(o.v)} style={{
              flex: 1, minWidth: 140, textAlign: 'left', padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
              border: '1px solid ' + (on ? 'var(--action)' : 'var(--gray-300)'),
              background: on ? 'var(--action)' : '#fff', color: on ? '#fff' : 'var(--text-primary)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{o.t}</div>
              <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>{o.d}</div>
            </button>
          );
        })}
      </div>

      {/* 대체상품: 쇼트난 기준 상품을 구매이력에서 선택 */}
      {mode === 'substitute' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {anchor ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'var(--action-muted)', borderRadius: 8, padding: '8px 12px' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>기준: {anchor.name}</div>
                <div style={hint}>{anchor.region || '산지미상'} · {anchor.price.toLocaleString()}원 · {anchor.count}회 구매</div>
              </div>
              <button onClick={() => onAnchorChange(null)} style={{ ...hint, background: 'none', border: '1px solid var(--gray-300)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>변경</button>
            </div>
          ) : (
            <>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="쇼트난 기준 상품 검색(구매이력)"
                style={{ padding: '6px 10px', fontSize: 13, border: '1px solid var(--gray-300)', borderRadius: 6, color: 'var(--text-primary)' }} />
              <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: 8 }}>
                {pLoading && <div style={{ ...hint, padding: 12 }}>구매이력 불러오는 중…</div>}
                {!pLoading && filtered.length === 0 && <div style={{ ...hint, padding: 12 }}>구매이력이 없습니다.</div>}
                {!pLoading && filtered.map((p) => (
                  <button key={p.item_code} onClick={() => onAnchorChange(p)} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, width: '100%', textAlign: 'left', padding: '8px 12px', background: '#fff', border: 'none', borderBottom: '1px solid var(--gray-100)', cursor: 'pointer' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{p.name}</span>
                    <span style={{ ...hint, whiteSpace: 'nowrap' }}>{p.price.toLocaleString()}원 · {p.last?.slice(0, 7) || ''}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          <button onClick={onGenerate} disabled={!anchor || loading} style={genBtn(!!anchor && !loading)}>
            {loading ? '분석 중…' : '대체상품 추천'}
          </button>
        </div>
      )}

      {/* 발굴/신규: 타입·가격범위·업태 지정 (거래처 이력 무관) */}
      {mode === 'discovery' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ ...hint, minWidth: 44 }}>타입</span>
            {TYPE_CHIPS.map(([k, label]) => {
              const on = discovery.types.includes(k);
              return (
                <button key={k} onClick={() => toggleType(k)} style={{
                  padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 999, cursor: 'pointer',
                  border: '1px solid ' + (on ? 'var(--action)' : 'var(--gray-300)'),
                  background: on ? 'var(--action)' : '#fff', color: on ? '#fff' : 'var(--text-tertiary)',
                }}>{label}</button>
              );
            })}
            <span style={hint}>{discovery.types.length ? '' : '(전체)'}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ ...hint, minWidth: 44 }}>가격대</span>
            <input type="number" min={0} step={1000} placeholder="최소" value={discovery.minPrice || ''} style={numIn}
              onChange={(e) => onDiscoveryChange({ discoveryMinPrice: Math.max(0, parseInt(e.target.value, 10) || 0) })} />
            <span style={hint}>~</span>
            <input type="number" min={0} step={1000} placeholder="최대" value={discovery.maxPrice || ''} style={numIn}
              onChange={(e) => onDiscoveryChange({ discoveryMaxPrice: Math.max(0, parseInt(e.target.value, 10) || 0) })} />
            <span style={hint}>원 (0=무제한)</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ ...hint, minWidth: 44 }}>업태</span>
            <select value={discovery.segment} onChange={(e) => onDiscoveryChange({ discoverySegment: e.target.value })}
              style={{ padding: '5px 8px', fontSize: 13, border: '1px solid var(--gray-300)', borderRadius: 6, color: 'var(--text-primary)' }}>
              <option value="">거래처 업태 자동</option>
              {segments.map((s) => <option key={s.name} value={s.name}>{s.name} ({s.count})</option>)}
            </select>
            <span style={hint}>같은 업태 인기 와인을 가점</span>
          </div>
          <button onClick={onGenerate} disabled={loading} style={genBtn(!loading)}>
            {loading ? '분석 중…' : '발굴 추천'}
          </button>
        </div>
      )}
    </div>
  );
}
