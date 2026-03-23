'use client';

import { useState, useEffect, useCallback } from 'react';

interface MonthData { qty: number; amount: number }
interface CountryRow { name: string; qty: number; amount: number; months: Record<string, MonthData> }
interface RegionRow { name: string; qty: number }
interface TypeRow { name: string; qty: number; months: Record<string, MonthData> }
interface AnalysisData {
  period: { start: string; years: number };
  total_qty: number;
  match_rate: { country: number; region: number; type: number };
  countries: CountryRow[];
  regions: Record<string, RegionRow[]>;
  types: TypeRow[];
}

function fmt(n: number) { return n.toLocaleString(); }
function pct(part: number, total: number) { return total > 0 ? Math.round(part / total * 100) : 0; }

const TYPE_COLORS: Record<string, string> = {
  '레드': '#8B1A1A', '화이트': '#C4A35A', '스파클링': '#4A90D9', '로제': '#D4728A', '주정강화': '#8B6914',
};

export default function SalesAnalysisTab() {
  const [years, setYears] = useState(2);
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const [view, setView] = useState<'country' | 'type' | 'trend'>('country');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/marketing/sales-analysis?years=${years}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [years]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>분석 중...</div>;
  if (!data) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>데이터를 불러올 수 없습니다.</div>;

  // 월별 키 생성
  const allMonths = new Set<string>();
  for (const c of data.countries) for (const m of Object.keys(c.months)) allMonths.add(m);
  for (const t of data.types) for (const m of Object.keys(t.months)) allMonths.add(m);
  const sortedMonths = [...allMonths].sort();

  // 반기별 그룹
  const halfYears: { label: string; months: string[] }[] = [];
  const hyMap = new Map<string, string[]>();
  for (const m of sortedMonths) {
    const [y, mo] = m.split('-');
    const half = parseInt(mo) <= 6 ? `${y} 상반기` : `${y} 하반기`;
    if (!hyMap.has(half)) hyMap.set(half, []);
    hyMap.get(half)!.push(m);
  }
  for (const [label, months] of hyMap) halfYears.push({ label, months });

  const maxCountryQty = data.countries[0]?.qty || 1;

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#2c1810' }}>판매 분석</div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
            {fmt(data.total_qty)}병 | 국가 {data.match_rate.country}% / 지역 {data.match_rate.region}% / 타입 {data.match_rate.type}%
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[1, 2, 3].map(y => (
            <button key={y} onClick={() => setYears(y)} style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
              background: years === y ? '#5A1515' : 'rgba(90,21,21,0.06)',
              color: years === y ? '#fff' : '#5A1515', cursor: 'pointer',
            }}>{y}년</button>
          ))}
        </div>
      </div>

      {/* 뷰 탭 */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(90,21,21,0.04)', borderRadius: 8, padding: 2, marginBottom: 16, width: 'fit-content' }}>
        {([['country', '국가별'], ['type', '타입별'], ['trend', '추이']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} style={{
            padding: '7px 16px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: view === v ? 700 : 500,
            background: view === v ? '#fff' : 'transparent', color: view === v ? '#5A1515' : '#8a8580',
            cursor: 'pointer', boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          }}>{label}</button>
        ))}
      </div>

      {/* 국가별 */}
      {view === 'country' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.countries.map(c => {
            const expanded = expandedCountry === c.name;
            const regions = data.regions[c.name] || [];
            const barW = Math.max(4, pct(c.qty, maxCountryQty));
            return (
              <div key={c.name} style={{ background: '#fff', borderRadius: 10, border: '1px solid rgba(90,21,21,0.06)', overflow: 'hidden' }}>
                <div onClick={() => setExpandedCountry(expanded ? null : c.name)} style={{
                  padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{ width: 70, fontSize: 13, fontWeight: 700, color: '#2c1810', flexShrink: 0 }}>{c.name}</div>
                  <div style={{ flex: 1, height: 20, background: '#f5f0f0', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ width: `${barW}%`, height: '100%', background: 'linear-gradient(90deg, #5A1515, #8B3030)', borderRadius: 4, transition: 'width 0.3s' }} />
                    <span style={{ position: 'absolute', right: 8, top: 2, fontSize: 11, color: '#666', fontWeight: 600 }}>
                      {fmt(c.qty)}병 ({pct(c.qty, data.total_qty)}%)
                    </span>
                  </div>
                  <div style={{ width: 80, textAlign: 'right', fontSize: 11, color: '#999', flexShrink: 0 }}>
                    {c.amount > 0 ? (c.amount / 10000).toFixed(0) + '만' : ''}
                  </div>
                  <span style={{ fontSize: 10, color: '#bbb', flexShrink: 0 }}>{expanded ? '\u25BC' : '\u25B6'}</span>
                </div>
                {expanded && regions.length > 0 && (
                  <div style={{ padding: '0 16px 12px 16px', borderTop: '1px solid rgba(90,21,21,0.06)' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#999', padding: '8px 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      지역별 ({regions.length})
                    </div>
                    {regions.map((r, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 12 }}>
                        <div style={{ width: 120, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                        <div style={{ flex: 1, height: 12, background: '#f5f0f0', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${pct(r.qty, c.qty)}%`, height: '100%', background: '#C4A35A', borderRadius: 3, minWidth: 2 }} />
                        </div>
                        <div style={{ width: 70, textAlign: 'right', fontSize: 11, color: '#888', fontWeight: 500 }}>
                          {fmt(r.qty)} ({pct(r.qty, c.qty)}%)
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 타입별 */}
      {view === 'type' && (
        <div>
          {/* 파이 대신 바 */}
          <div style={{ display: 'flex', gap: 6, flexDirection: 'column' }}>
            {data.types.map(t => {
              const color = TYPE_COLORS[t.name] || '#666';
              return (
                <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#fff', borderRadius: 10, border: '1px solid rgba(90,21,21,0.06)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <div style={{ width: 60, fontSize: 13, fontWeight: 700, color }}>{t.name}</div>
                  <div style={{ flex: 1, height: 20, background: '#f5f0f0', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ width: `${pct(t.qty, data.total_qty)}%`, height: '100%', background: color, borderRadius: 4, opacity: 0.7 }} />
                    <span style={{ position: 'absolute', right: 8, top: 2, fontSize: 11, color: '#666', fontWeight: 600 }}>
                      {fmt(t.qty)}병 ({pct(t.qty, data.total_qty)}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 국가별 타입 분포 (주요 5개국) */}
          <div style={{ marginTop: 20, fontSize: 12, fontWeight: 700, color: '#2c1810', marginBottom: 8 }}>주요 국가별 타입 분포</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
            {data.countries.slice(0, 6).map(c => {
              // 해당 국가의 타입별 수량은 API에서 안주므로 표시만
              return (
                <div key={c.name} style={{ background: '#fff', borderRadius: 10, border: '1px solid rgba(90,21,21,0.06)', padding: '12px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2c1810', marginBottom: 4 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>{fmt(c.qty)}병</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 추이 */}
      {view === 'trend' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 600 }}>
            <thead>
              <tr style={{ background: '#f8f6f4', borderBottom: '2px solid rgba(90,21,21,0.1)' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#5A1515', position: 'sticky', left: 0, background: '#f8f6f4', zIndex: 1 }}>국가</th>
                {halfYears.map(h => (
                  <th key={h.label} style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 600, color: '#666', whiteSpace: 'nowrap' }}>{h.label}</th>
                ))}
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#5A1515' }}>합계</th>
              </tr>
            </thead>
            <tbody>
              {data.countries.slice(0, 12).map((c, i) => (
                <tr key={c.name} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '6px 12px', fontWeight: 600, color: '#2c1810', position: 'sticky', left: 0, background: i % 2 === 0 ? '#fff' : '#fafafa', zIndex: 1 }}>{c.name}</td>
                  {halfYears.map(h => {
                    const qty = h.months.reduce((s, m) => s + (c.months[m]?.qty || 0), 0);
                    return <td key={h.label} style={{ padding: '6px 8px', textAlign: 'right', color: qty > 0 ? '#333' : '#ddd' }}>{qty > 0 ? fmt(qty) : '-'}</td>;
                  })}
                  <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: '#5A1515' }}>{fmt(c.qty)}</td>
                </tr>
              ))}
              {/* 타입별 추이 */}
              <tr style={{ borderTop: '2px solid rgba(90,21,21,0.1)' }}>
                <td colSpan={halfYears.length + 2} style={{ padding: '10px 12px 4px', fontWeight: 700, color: '#5A1515', fontSize: 12 }}>타입별</td>
              </tr>
              {data.types.map((t, i) => (
                <tr key={t.name} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '6px 12px', fontWeight: 600, color: TYPE_COLORS[t.name] || '#333', position: 'sticky', left: 0, background: i % 2 === 0 ? '#fff' : '#fafafa', zIndex: 1 }}>{t.name}</td>
                  {halfYears.map(h => {
                    const qty = h.months.reduce((s, m) => s + (t.months[m]?.qty || 0), 0);
                    return <td key={h.label} style={{ padding: '6px 8px', textAlign: 'right', color: qty > 0 ? '#333' : '#ddd' }}>{qty > 0 ? fmt(qty) : '-'}</td>;
                  })}
                  <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: TYPE_COLORS[t.name] || '#333' }}>{fmt(t.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
