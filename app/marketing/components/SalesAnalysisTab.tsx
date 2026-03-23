'use client';

import { useState, useEffect, useCallback } from 'react';

interface CountryRow { name: string; qty: number; amount: number; items: number }
interface RegionRow { name: string; qty: number }
interface TypeRow { name: string; qty: number }
interface TopItem { item_no: string; item_name: string; qty: number; amount: number; country: string; region: string | null; wine_type: string | null }
interface MonthlyRow { month: string; qty: number }
interface AnalysisData {
  total_qty: number;
  match_rate: { country: number; region: number; type: number };
  countries: CountryRow[];
  regions: Record<string, RegionRow[]>;
  types: TypeRow[];
  top_items: TopItem[];
  monthly: MonthlyRow[];
}
interface FilterOptions { countries: string[]; regions: Record<string, string[]>; types: string[] }

function fmt(n: number) { return n.toLocaleString(); }
function pct(part: number, total: number) { return total > 0 ? Math.round(part / total * 100) : 0; }

const TYPE_COLORS: Record<string, string> = {
  '레드': '#8B1A1A', '화이트': '#C4A35A', '스파클링': '#4A90D9', '로제': '#D4728A', '주정강화': '#8B6914',
};

export default function SalesAnalysisTab() {
  // 필터 옵션
  const [options, setOptions] = useState<FilterOptions | null>(null);

  // 필터
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = kstNow.toISOString().slice(0, 10);
  const twoYearsAgo = `${kstNow.getUTCFullYear() - 2}-${String(kstNow.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const [startDate, setStartDate] = useState(twoYearsAgo);
  const [endDate, setEndDate] = useState(today);
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [wineType, setWineType] = useState('');

  // 결과
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // 뷰
  const [view, setView] = useState<'summary' | 'items' | 'trend'>('summary');
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const [itemShowAll, setItemShowAll] = useState(false);

  // 필터 옵션 로드
  useEffect(() => {
    fetch('/api/marketing/sales-analysis?mode=options')
      .then(r => r.json()).then(setOptions).catch(() => {});
  }, []);

  // 국가 변경 시 지역 초기화
  useEffect(() => { setRegion(''); }, [country]);

  const availableRegions = country && options?.regions[country] ? options.regions[country] : [];

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      if (country) params.set('country', country);
      if (region) params.set('region', region);
      if (wineType) params.set('wine_type', wineType);
      const res = await fetch(`/api/marketing/sales-analysis?${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setView('summary');
      setExpandedCountry(null);
    } catch { setData(null); }
    finally { setLoading(false); }
  };

  // 빠른 기간 버튼
  const quickRanges = [
    { label: '1년', start: `${kstNow.getUTCFullYear() - 1}-${String(kstNow.getUTCMonth() + 1).padStart(2, '0')}-01` },
    { label: '2년', start: `${kstNow.getUTCFullYear() - 2}-${String(kstNow.getUTCMonth() + 1).padStart(2, '0')}-01` },
    { label: '3년', start: `${kstNow.getUTCFullYear() - 3}-${String(kstNow.getUTCMonth() + 1).padStart(2, '0')}-01` },
    { label: '올해', start: `${kstNow.getUTCFullYear()}-01-01` },
  ];

  const maxCountryQty = data?.countries[0]?.qty || 1;
  const maxMonthQty = data?.monthly ? Math.max(...data.monthly.map(m => m.qty), 1) : 1;

  return (
    <div>
      {/* 필터 영역 */}
      <div style={{
        background: '#fff', borderRadius: 14, border: '1px solid rgba(90,21,21,0.06)',
        boxShadow: '0 2px 8px rgba(90,21,21,0.03)', padding: 18, marginBottom: 16,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#2c1810', marginBottom: 14 }}>판매 분석</div>

        {/* 기간 */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
          <div style={{ flex: '1 1 130px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#a8a098', display: 'block', marginBottom: 4 }}>시작일</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid rgba(90,21,21,0.08)', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#faf9f7' }} />
          </div>
          <div style={{ flex: '1 1 130px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#a8a098', display: 'block', marginBottom: 4 }}>종료일</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid rgba(90,21,21,0.08)', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#faf9f7' }} />
          </div>
        </div>

        {/* 빠른 기간 */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {quickRanges.map(r => (
            <button key={r.label} onClick={() => { setStartDate(r.start); setEndDate(today); }}
              style={{
                padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(90,21,21,0.1)',
                background: startDate === r.start ? 'rgba(90,21,21,0.06)' : 'transparent',
                fontSize: 11, color: '#5A1515', cursor: 'pointer', fontWeight: 500,
              }}>{r.label}</button>
          ))}
        </div>

        {/* 국가 / 지역 / 타입 */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ flex: '1 1 140px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#a8a098', display: 'block', marginBottom: 4 }}>국가</label>
            <select value={country} onChange={e => setCountry(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid rgba(90,21,21,0.08)', fontSize: 14, outline: 'none', background: '#faf9f7', color: '#2c1810' }}>
              <option value="">전체</option>
              {(options?.countries || []).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#a8a098', display: 'block', marginBottom: 4 }}>지역</label>
            <select value={region} onChange={e => setRegion(e.target.value)} disabled={!country || availableRegions.length === 0}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid rgba(90,21,21,0.08)', fontSize: 14, outline: 'none', background: '#faf9f7', color: country ? '#2c1810' : '#ccc' }}>
              <option value="">전체</option>
              {availableRegions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 120px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#a8a098', display: 'block', marginBottom: 4 }}>타입</label>
            <select value={wineType} onChange={e => setWineType(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid rgba(90,21,21,0.08)', fontSize: 14, outline: 'none', background: '#faf9f7', color: '#2c1810' }}>
              <option value="">전체</option>
              {(options?.types || []).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* 조회 버튼 */}
        <button onClick={handleSearch} disabled={loading}
          style={{
            padding: '10px 28px', borderRadius: 10, border: 'none',
            background: loading ? '#c4a0a0' : '#5A1515', color: '#fff',
            fontSize: 14, fontWeight: 600, cursor: loading ? 'default' : 'pointer',
          }}>{loading ? '분석 중...' : '조회'}</button>

        {/* 현재 필터 태그 */}
        {searched && data && (
          <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#999' }}>{fmt(data.total_qty)}병</span>
            {country && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(90,21,21,0.06)', color: '#5A1515', fontWeight: 600 }}>{country}</span>}
            {region && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(196,163,90,0.15)', color: '#8B6914', fontWeight: 600 }}>{region}</span>}
            {wineType && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: TYPE_COLORS[wineType] + '15', color: TYPE_COLORS[wineType] || '#666', fontWeight: 600 }}>{wineType}</span>}
            <span style={{ fontSize: 10, color: '#bbb' }}>
              매칭 국가{data.match_rate.country}% 지역{data.match_rate.region}% 타입{data.match_rate.type}%
            </span>
          </div>
        )}
      </div>

      {/* 결과 */}
      {searched && data && data.total_qty > 0 && (
        <>
          {/* 뷰 탭 */}
          <div style={{ display: 'flex', gap: 4, background: 'rgba(90,21,21,0.04)', borderRadius: 8, padding: 2, marginBottom: 12, width: 'fit-content' }}>
            {([['summary', '요약'], ['items', '품목별'], ['trend', '추이']] as const).map(([v, label]) => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '7px 16px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: view === v ? 700 : 500,
                background: view === v ? '#fff' : 'transparent', color: view === v ? '#5A1515' : '#8a8580',
                cursor: 'pointer', boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>{label}</button>
            ))}
          </div>

          {/* 요약 뷰 */}
          {view === 'summary' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* 타입 분포 (상단 요약) */}
              {data.types.length > 0 && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
                  {data.types.map(t => (
                    <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_COLORS[t.name] || '#666' }} />
                      <span style={{ fontWeight: 600, color: TYPE_COLORS[t.name] || '#666' }}>{t.name}</span>
                      <span style={{ color: '#999' }}>{fmt(t.qty)} ({pct(t.qty, data.total_qty)}%)</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 국가별 */}
              {data.countries.map(c => {
                const expanded = expandedCountry === c.name;
                const regions = data.regions[c.name] || [];
                const barW = Math.max(4, pct(c.qty, maxCountryQty));
                return (
                  <div key={c.name} style={{ background: '#fff', borderRadius: 10, border: '1px solid rgba(90,21,21,0.06)', overflow: 'hidden' }}>
                    <div onClick={() => setExpandedCountry(expanded ? null : c.name)} style={{
                      padding: '12px 16px', cursor: regions.length > 0 ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <div style={{ width: 70, fontSize: 13, fontWeight: 700, color: '#2c1810', flexShrink: 0 }}>{c.name}</div>
                      <div style={{ flex: 1, height: 20, background: '#f5f0f0', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                        <div style={{ width: `${barW}%`, height: '100%', background: 'linear-gradient(90deg, #5A1515, #8B3030)', borderRadius: 4 }} />
                        <span style={{ position: 'absolute', right: 8, top: 2, fontSize: 11, color: '#666', fontWeight: 600 }}>
                          {fmt(c.qty)}병 ({pct(c.qty, data.total_qty)}%)
                        </span>
                      </div>
                      <div style={{ width: 60, textAlign: 'right', fontSize: 11, color: '#999', flexShrink: 0 }}>{c.items}종</div>
                      {regions.length > 0 && <span style={{ fontSize: 10, color: '#bbb', flexShrink: 0 }}>{expanded ? '\u25BC' : '\u25B6'}</span>}
                    </div>
                    {expanded && regions.length > 0 && (
                      <div style={{ padding: '0 16px 12px', borderTop: '1px solid rgba(90,21,21,0.06)' }}>
                        {regions.map((r, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 12 }}>
                            <div style={{ width: 140, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                            <div style={{ flex: 1, height: 12, background: '#f5f0f0', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${pct(r.qty, c.qty)}%`, height: '100%', background: '#C4A35A', borderRadius: 3, minWidth: 2 }} />
                            </div>
                            <div style={{ width: 70, textAlign: 'right', fontSize: 11, color: '#888', fontWeight: 500 }}>{fmt(r.qty)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 품목별 뷰 */}
          {view === 'items' && data.top_items && (() => {
            const LIMIT = 50;
            const [showAll, setShowAll] = [data.top_items.length <= LIMIT, null]; // 항상 페이지네이션
            const items = itemShowAll ? data.top_items : data.top_items.slice(0, LIMIT);
            return (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(90,21,21,0.06)', overflow: 'hidden' }}>
                <div style={{ padding: '8px 16px', fontSize: 12, color: '#999', borderBottom: '1px solid #f0f0f0' }}>
                  총 {data.top_items.length}개 품목
                </div>
                <div style={{ overflowX: 'auto', maxHeight: 600, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 600 }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                      <tr style={{ background: '#f8f6f4', borderBottom: '2px solid rgba(90,21,21,0.1)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#5A1515' }}>품목</th>
                        <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 600, color: '#666' }}>국가</th>
                        <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 600, color: '#666' }}>타입</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#5A1515' }}>수량</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(itemShowAll ? data.top_items : data.top_items.slice(0, LIMIT)).map((item, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={{ padding: '6px 12px', color: '#2c1810', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ color: '#999', fontSize: 10, marginRight: 6 }}>{item.item_no}</span>
                            {item.item_name}
                          </td>
                          <td style={{ padding: '6px 8px', color: '#666', fontSize: 11 }}>{item.country || '-'}</td>
                          <td style={{ padding: '6px 8px', fontSize: 11, color: TYPE_COLORS[item.wine_type || ''] || '#666', fontWeight: 600 }}>{item.wine_type || '-'}</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: '#2c1810' }}>{fmt(item.qty)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {data.top_items.length > LIMIT && (
                  <div style={{ padding: '8px 16px', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
                    <button onClick={() => setItemShowAll(v => !v)} style={{
                      fontSize: 12, fontWeight: 500, color: '#5A1515', background: 'transparent',
                      border: '1px solid rgba(90,21,21,0.15)', borderRadius: 6, padding: '4px 14px', cursor: 'pointer',
                    }}>{itemShowAll ? '50개만' : `전체 ${data.top_items.length}개`}</button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* 추이 뷰 */}
          {view === 'trend' && data.monthly && (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(90,21,21,0.06)', padding: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {data.monthly.map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
                    <div style={{ width: 55, fontSize: 11, color: '#999', flexShrink: 0 }}>{m.month}</div>
                    <div style={{ flex: 1, height: 16, background: '#f5f0f0', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct(m.qty, maxMonthQty)}%`, height: '100%', background: '#5A1515', borderRadius: 3, minWidth: m.qty > 0 ? 2 : 0 }} />
                    </div>
                    <div style={{ width: 60, textAlign: 'right', fontSize: 11, color: '#666', fontWeight: 500 }}>{fmt(m.qty)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* 결과 없음 */}
      {searched && !loading && data && data.total_qty === 0 && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center', color: '#8a8580', fontSize: 14, border: '1px solid rgba(90,21,21,0.06)' }}>
          해당 조건에 맞는 판매 데이터가 없습니다.
        </div>
      )}

      {/* 초기 안내 */}
      {!searched && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center', color: '#8a8580', fontSize: 13, border: '1px solid rgba(90,21,21,0.06)', lineHeight: 1.8 }}>
          기간과 조건을 설정한 후 <strong style={{ color: '#5A1515' }}>조회</strong> 버튼을 눌러주세요.
        </div>
      )}
    </div>
  );
}
