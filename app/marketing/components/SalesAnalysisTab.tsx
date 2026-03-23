'use client';

import { useState, useEffect } from 'react';

interface TypeQty { name: string; qty: number }
interface CountryRow { name: string; qty: number; amount: number; items: number; avg_price: number; types: TypeQty[] }
interface RegionRow { name: string; qty: number; amount: number; avg_price: number }
interface TypeRow { name: string; qty: number; amount: number; avg_price: number }
interface TopItem { item_no: string; item_name: string; qty: number; amount: number; avg_price: number; country: string; region: string | null; wine_type: string | null }
interface MonthlyRow { month: string; qty: number }
interface AnalysisData {
  total_qty: number; total_amount: number; total_items: number;
  daily_avg: number; monthly_avg: number;
  match_rate: { country: number; region: number; type: number };
  countries: CountryRow[]; regions: Record<string, RegionRow[]>;
  types: TypeRow[]; top_items: TopItem[]; monthly: MonthlyRow[];
}
interface FilterOptions { countries: string[]; regions: Record<string, string[]>; types: string[]; volumes: string[] }

function fmt(n: number) { return n.toLocaleString(); }
function fmtM(n: number) { return n >= 100000000 ? (n / 100000000).toFixed(1) + '억' : n >= 10000 ? Math.round(n / 10000).toLocaleString() + '만' : fmt(n); }
function pct(part: number, total: number) { return total > 0 ? Math.round(part / total * 100) : 0; }

const TYPE_COLORS: Record<string, string> = { '레드': '#8B1A1A', '화이트': '#C4A35A', '스파클링': '#4A90D9', '로제': '#D4728A', '주정강화': '#8B6914' };
const TYPE_BG: Record<string, string> = { '레드': 'rgba(139,26,26,0.08)', '화이트': 'rgba(196,163,90,0.08)', '스파클링': 'rgba(74,144,217,0.08)', '로제': 'rgba(212,114,138,0.08)', '주정강화': 'rgba(139,105,20,0.08)' };

export default function SalesAnalysisTab() {
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = kstNow.toISOString().slice(0, 10);
  const twoYearsAgo = `${kstNow.getUTCFullYear() - 2}-${String(kstNow.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const [startDate, setStartDate] = useState(twoYearsAgo);
  const [endDate, setEndDate] = useState(today);
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [wineType, setWineType] = useState('');
  const [volume, setVolume] = useState('');
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [view, setView] = useState<'summary' | 'items' | 'trend'>('summary');
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const [itemShowAll, setItemShowAll] = useState(false);

  useEffect(() => { fetch('/api/marketing/sales-analysis?mode=options').then(r => r.json()).then(setOptions).catch(() => {}); }, []);
  useEffect(() => { setRegion(''); }, [country]);
  const availableRegions = country && options?.regions[country] ? options.regions[country] : [];

  const handleSearch = async () => {
    setLoading(true); setSearched(true); setItemShowAll(false);
    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      if (country) params.set('country', country);
      if (region) params.set('region', region);
      if (wineType) params.set('wine_type', wineType);
      if (volume) params.set('volume', volume);
      const res = await fetch(`/api/marketing/sales-analysis?${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json); setView('summary'); setExpandedCountry(null);
    } catch { setData(null); }
    finally { setLoading(false); }
  };

  const quickRanges = [
    { label: '1년', start: `${kstNow.getUTCFullYear() - 1}-${String(kstNow.getUTCMonth() + 1).padStart(2, '0')}-01` },
    { label: '2년', start: twoYearsAgo },
    { label: '3년', start: `${kstNow.getUTCFullYear() - 3}-${String(kstNow.getUTCMonth() + 1).padStart(2, '0')}-01` },
    { label: '올해', start: `${kstNow.getUTCFullYear()}-01-01` },
  ];

  const maxCountryQty = data?.countries[0]?.qty || 1;
  const maxMonthQty = data?.monthly ? Math.max(...data.monthly.map(m => m.qty), 1) : 1;

  const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid rgba(90,21,21,0.08)', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, background: '#faf9f7', color: '#2c1810' };
  const labelStyle = { fontSize: 11, fontWeight: 600 as const, color: '#a8a098', display: 'block' as const, marginBottom: 4 };

  return (
    <div>
      {/* 필터 */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(90,21,21,0.06)', boxShadow: '0 2px 8px rgba(90,21,21,0.03)', padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#2c1810', marginBottom: 14 }}>판매 분석</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }}>
          <div style={{ flex: '1 1 130px' }}><label style={labelStyle}>시작일</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} /></div>
          <div style={{ flex: '1 1 130px' }}><label style={labelStyle}>종료일</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} /></div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {quickRanges.map(r => (
            <button key={r.label} onClick={() => { setStartDate(r.start); setEndDate(today); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(90,21,21,0.1)', background: startDate === r.start ? 'rgba(90,21,21,0.06)' : 'transparent', fontSize: 11, color: '#5A1515', cursor: 'pointer', fontWeight: 500 }}>{r.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ flex: '1 1 140px' }}><label style={labelStyle}>국가</label><select value={country} onChange={e => setCountry(e.target.value)} style={inputStyle}><option value="">전체</option>{(options?.countries || []).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div style={{ flex: '1 1 180px' }}><label style={labelStyle}>지역</label><select value={region} onChange={e => setRegion(e.target.value)} disabled={!country || availableRegions.length === 0} style={{ ...inputStyle, color: country ? '#2c1810' : '#ccc' }}><option value="">전체</option>{availableRegions.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
          <div style={{ flex: '1 1 120px' }}><label style={labelStyle}>타입</label><select value={wineType} onChange={e => setWineType(e.target.value)} style={inputStyle}><option value="">전체</option>{(options?.types || []).map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div style={{ flex: '0 1 100px' }}><label style={labelStyle}>단위</label><select value={volume} onChange={e => setVolume(e.target.value)} style={inputStyle}><option value="">전체</option>{(options?.volumes || []).map(v => <option key={v} value={v}>{v}</option>)}</select></div>
        </div>
        <button onClick={handleSearch} disabled={loading} style={{ padding: '10px 28px', borderRadius: 10, border: 'none', background: loading ? '#c4a0a0' : '#5A1515', color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading ? 'default' : 'pointer' }}>
          {loading ? '분석 중...' : '조회'}
        </button>
      </div>

      {/* 결과 */}
      {searched && data && data.total_qty > 0 && (
        <>
          {/* KPI 카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
            {[
              { label: '총 판매량', value: fmt(data.total_qty) + '병', sub: '일 ' + fmt(data.daily_avg) + '병' },
              { label: '총 금액', value: fmtM(data.total_amount) + '원', sub: '월 ' + fmtM(Math.round(data.total_amount / Math.max(1, data.monthly.length))) },
              { label: '품목 수', value: fmt(data.total_items) + '종', sub: '월 평균 ' + fmt(data.monthly_avg) + '병' },
              { label: '평균 단가', value: data.total_qty > 0 ? fmt(Math.round(data.total_amount / data.total_qty)) + '원' : '-', sub: data.countries[0] ? data.countries[0].name + ' ' + pct(data.countries[0].qty, data.total_qty) + '%' : '' },
            ].map((card, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(90,21,21,0.06)', padding: '14px 16px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#a8a098', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{card.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#2c1810' }}>{card.value}</div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{card.sub}</div>
              </div>
            ))}
          </div>

          {/* 타입 분포 바 */}
          {data.types.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(90,21,21,0.06)', padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', height: 24, borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
                {data.types.map(t => (
                  <div key={t.name} title={`${t.name} ${fmt(t.qty)}병 (${pct(t.qty, data.total_qty)}%)`} style={{ width: `${pct(t.qty, data.total_qty)}%`, background: TYPE_COLORS[t.name] || '#999', minWidth: t.qty > 0 ? 2 : 0, transition: 'width 0.3s' }} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {data.types.map(t => (
                  <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: TYPE_COLORS[t.name] || '#999' }} />
                    <span style={{ fontWeight: 600, color: '#333' }}>{t.name}</span>
                    <span style={{ color: '#999' }}>{fmt(t.qty)} ({pct(t.qty, data.total_qty)}%)</span>
                    <span style={{ color: '#bbb' }}>{fmtM(t.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 뷰 탭 */}
          <div style={{ display: 'flex', gap: 4, background: 'rgba(90,21,21,0.04)', borderRadius: 8, padding: 2, marginBottom: 12, width: 'fit-content' }}>
            {([['summary', '국가/지역'], ['items', '품목별 ' + data.top_items.length], ['trend', '월별 추이']] as const).map(([v, label]) => (
              <button key={v} onClick={() => setView(v as any)} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: view === v ? 700 : 500, background: view === v ? '#fff' : 'transparent', color: view === v ? '#5A1515' : '#8a8580', cursor: 'pointer', boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>{label}</button>
            ))}
          </div>

          {/* 국가/지역 뷰 */}
          {view === 'summary' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.countries.map(c => {
                const expanded = expandedCountry === c.name;
                const regions = data.regions[c.name] || [];
                return (
                  <div key={c.name} style={{ background: '#fff', borderRadius: 10, border: '1px solid rgba(90,21,21,0.06)', overflow: 'hidden' }}>
                    <div onClick={() => setExpandedCountry(expanded ? null : c.name)} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 65, fontSize: 13, fontWeight: 700, color: '#2c1810', flexShrink: 0 }}>{c.name}</div>
                      <div style={{ flex: 1, height: 22, background: '#f5f0f0', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                        {/* 타입별 스택 바 */}
                        <div style={{ display: 'flex', height: '100%' }}>
                          {c.types.map(t => (
                            <div key={t.name} style={{ width: `${pct(t.qty, c.qty)}%`, height: '100%', background: TYPE_COLORS[t.name] || '#ccc', minWidth: t.qty > 0 ? 1 : 0 }} title={`${t.name} ${pct(t.qty, c.qty)}%`} />
                          ))}
                        </div>
                        <span style={{ position: 'absolute', right: 8, top: 3, fontSize: 11, color: '#444', fontWeight: 600, textShadow: '0 0 3px #fff, 0 0 3px #fff' }}>
                          {fmt(c.qty)} ({pct(c.qty, data.total_qty)}%)
                        </span>
                      </div>
                      <div style={{ width: 65, textAlign: 'right', fontSize: 11, color: '#999', flexShrink: 0 }}>{fmtM(c.amount)}</div>
                      <div style={{ width: 55, textAlign: 'right', fontSize: 10, color: '#bbb', flexShrink: 0 }}>{c.items}종</div>
                      <span style={{ fontSize: 10, color: '#ccc', flexShrink: 0 }}>{expanded ? '\u25BC' : '\u25B6'}</span>
                    </div>
                    {expanded && (
                      <div style={{ padding: '0 16px 14px', borderTop: '1px solid rgba(90,21,21,0.04)' }}>
                        {/* 국가별 타입 미니 */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 0 10px' }}>
                          {c.types.map(t => (
                            <span key={t.name} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: TYPE_BG[t.name] || '#f0f0f0', color: TYPE_COLORS[t.name] || '#666', fontWeight: 600 }}>
                              {t.name} {fmt(t.qty)} ({pct(t.qty, c.qty)}%)
                            </span>
                          ))}
                        </div>
                        {regions.length > 0 && (
                          <>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#999', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>지역별</div>
                            {regions.map((r, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 }}>
                                <div style={{ width: 110, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{r.name}</div>
                                <div style={{ flex: 1, height: 14, background: '#f5f0f0', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                                  <div style={{ width: `${pct(r.qty, c.qty)}%`, height: '100%', background: '#C4A35A', borderRadius: 3, minWidth: 2 }} />
                                </div>
                                <div style={{ width: 55, textAlign: 'right', fontSize: 11, color: '#888', fontWeight: 500, flexShrink: 0 }}>{fmt(r.qty)}</div>
                                <div style={{ width: 50, textAlign: 'right', fontSize: 10, color: '#bbb', flexShrink: 0 }}>{fmtM(r.amount)}</div>
                                <div style={{ width: 55, textAlign: 'right', fontSize: 10, color: '#aaa', flexShrink: 0 }}>{fmt(r.avg_price)}원</div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 품목별 뷰 */}
          {view === 'items' && data.top_items && (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(90,21,21,0.06)', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto', maxHeight: 600, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 700 }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr style={{ background: '#f8f6f4', borderBottom: '2px solid rgba(90,21,21,0.1)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#5A1515' }}>품목</th>
                      <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 600, color: '#666' }}>국가</th>
                      <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 600, color: '#666' }}>지역</th>
                      <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 600, color: '#666' }}>타입</th>
                      <th style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 600, color: '#666' }}>평균단가</th>
                      <th style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 600, color: '#666' }}>금액</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#5A1515' }}>수량</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(itemShowAll ? data.top_items : data.top_items.slice(0, 50)).map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '6px 12px', color: '#2c1810', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ color: '#bbb', fontSize: 10, marginRight: 4 }}>{item.item_no}</span>{item.item_name}
                        </td>
                        <td style={{ padding: '6px 8px', color: '#666', fontSize: 11 }}>{item.country || '-'}</td>
                        <td style={{ padding: '6px 8px', color: '#888', fontSize: 10 }}>{item.region || '-'}</td>
                        <td style={{ padding: '6px 8px', fontSize: 11, color: TYPE_COLORS[item.wine_type || ''] || '#666', fontWeight: 600 }}>{item.wine_type || '-'}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: 11, color: '#888' }}>{item.avg_price > 0 ? fmt(item.avg_price) : '-'}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: 11, color: '#666' }}>{item.amount > 0 ? fmtM(item.amount) : '-'}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: '#2c1810' }}>{fmt(item.qty)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.top_items.length > 50 && (
                <div style={{ padding: '8px 16px', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
                  <button onClick={() => setItemShowAll(v => !v)} style={{ fontSize: 12, fontWeight: 500, color: '#5A1515', background: 'transparent', border: '1px solid rgba(90,21,21,0.15)', borderRadius: 6, padding: '4px 14px', cursor: 'pointer' }}>
                    {itemShowAll ? '50개만' : `전체 ${data.top_items.length}개`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 추이 뷰 */}
          {view === 'trend' && data.monthly && (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(90,21,21,0.06)', padding: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {data.monthly.map((m, i) => {
                  const prevQty = i > 0 ? data.monthly[i - 1].qty : 0;
                  const change = prevQty > 0 ? Math.round((m.qty - prevQty) / prevQty * 100) : 0;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                      <div style={{ width: 55, fontSize: 11, color: '#999', flexShrink: 0 }}>{m.month}</div>
                      <div style={{ flex: 1, height: 20, background: '#f5f0f0', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pct(m.qty, maxMonthQty)}%`, height: '100%', background: m.qty >= data.monthly_avg ? '#5A1515' : '#C4A0A0', borderRadius: 3, minWidth: m.qty > 0 ? 2 : 0, transition: 'width 0.3s' }} />
                      </div>
                      <div style={{ width: 55, textAlign: 'right', fontSize: 11, color: '#666', fontWeight: 500, flexShrink: 0 }}>{fmt(m.qty)}</div>
                      {i > 0 && change !== 0 && (
                        <div style={{ width: 40, textAlign: 'right', fontSize: 10, fontWeight: 600, color: change > 0 ? '#16a34a' : '#dc2626', flexShrink: 0 }}>
                          {change > 0 ? '+' : ''}{change}%
                        </div>
                      )}
                      {(i === 0 || change === 0) && <div style={{ width: 40, flexShrink: 0 }} />}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: '#999', display: 'flex', gap: 16 }}>
                <span>월 평균 {fmt(data.monthly_avg)}병</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 12, height: 8, borderRadius: 2, background: '#5A1515', display: 'inline-block' }} /> 평균 이상
                  <span style={{ width: 12, height: 8, borderRadius: 2, background: '#C4A0A0', display: 'inline-block', marginLeft: 8 }} /> 평균 이하
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {searched && !loading && data && data.total_qty === 0 && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center', color: '#8a8580', fontSize: 14, border: '1px solid rgba(90,21,21,0.06)' }}>
          해당 조건에 맞는 판매 데이터가 없습니다.
        </div>
      )}

      {!searched && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center', color: '#8a8580', fontSize: 13, border: '1px solid rgba(90,21,21,0.06)', lineHeight: 1.8 }}>
          기간과 조건을 설정한 후 <strong style={{ color: '#5A1515' }}>조회</strong> 버튼을 눌러주세요.
        </div>
      )}
    </div>
  );
}
