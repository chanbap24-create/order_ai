'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Cell } from 'recharts';

const PieChart = dynamic(() => import('recharts').then(m => m.PieChart), { ssr: false });
const Pie = dynamic(() => import('recharts').then(m => m.Pie), { ssr: false });
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
const Legend = dynamic(() => import('recharts').then(m => m.Legend), { ssr: false });

const PALETTE = ['#9B6B8A', '#7B9EA8', '#C4A882', '#8FAD88', '#B08EA2', '#A8886E', '#7E9BB5', '#C49B8A', '#8E8DB5', '#8CB4A0'];

function fmt(n: number) {
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '억';
  if (n >= 1e4) return (n / 1e4).toFixed(0) + '만';
  return n.toLocaleString();
}

function fmtFull(n: number) {
  return n.toLocaleString() + '원';
}

function pctChange(cur: number, prev: number) {
  if (!prev) return null;
  return ((cur - prev) / prev * 100).toFixed(1);
}

interface SuggestionItem { code: string; name: string; }

export default function AnalysisPage() {
  const [type, setType] = useState<'wine' | 'glass'>('wine');
  const [filters, setFilters] = useState<{ managers: string[]; departments: string[] }>({ managers: [], departments: [] });
  const [dateRange, setDateRange] = useState<{ min: string; max: string } | null>(null);
  const [manager, setManager] = useState('');
  const [department, setDepartment] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [clientCode, setClientCode] = useState('');
  const [clientName, setClientName] = useState('');
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestRef = useRef<HTMLDivElement>(null);

  const isWine = type === 'wine';

  useEffect(() => { setMounted(true); }, []);

  // type 변경 시 필터 & 데이터 초기화
  const handleTypeChange = (t: 'wine' | 'glass') => {
    setType(t);
    setManager(''); setDepartment('');
    setClientSearch(''); setClientCode(''); setClientName('');
    setSuggestions([]); setShowSuggestions(false);
    setData(null);
  };

  // 필터 로드
  useEffect(() => {
    fetch(`/api/analysis/client?filters=1&type=${type}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setFilters({ managers: d.managers || [], departments: d.departments || [] });
          if (d.dateRange) {
            setDateRange(d.dateRange);
          }
        }
      });
  }, [type]);

  // 외부 클릭으로 suggestion 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 자동완성
  const handleClientSearch = useCallback((val: string) => {
    setClientSearch(val);
    setClientCode('');
    setClientName('');
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (val.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    suggestTimer.current = setTimeout(() => {
      fetch(`/api/analysis/client?suggest=${encodeURIComponent(val)}&type=${type}`)
        .then(r => r.json())
        .then(d => {
          if (d.success) { setSuggestions(d.clients || []); setShowSuggestions(true); }
        });
    }, 300);
  }, [type]);

  const selectClient = (c: SuggestionItem) => {
    setClientCode(c.code);
    setClientName(c.name);
    setClientSearch(c.name);
    setShowSuggestions(false);
  };

  // 데이터 로드
  const loadData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('type', type);
    if (manager) params.set('manager', manager);
    if (department) params.set('department', department);
    if (clientCode) params.set('client', clientCode);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    fetch(`/api/analysis/client?${params}`)
      .then(r => r.json())
      .then(d => { if (d.success) setData(d); })
      .finally(() => setLoading(false));
  }, [type, manager, department, clientCode, startDate, endDate]);

  // type 변경 또는 최초 로드 시 자동 조회
  useEffect(() => {
    loadData();
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  const filterLabel = [
    manager && `담당: ${manager}`,
    department && `부서: ${department}`,
    clientName && `거래처: ${clientName}`,
  ].filter(Boolean).join(' / ');

  return (
    <>
      <style>{`
        .analysis-root { padding: 0 16px 24px; max-width: 960px; margin: 0 auto; font-family: 'DM Sans', -apple-system, sans-serif; }
        .analysis-card { background: #fff; border: 1px solid #E8E8E8; border-radius: 12px; padding: 20px; }
        .analysis-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .analysis-grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        .analysis-chart-title { font-size: 0.82rem; font-weight: 600; color: #333; margin-bottom: 12px; }
        .analysis-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
        .analysis-table th { background: #faf5f5; color: #5A1515; font-weight: 600; padding: 10px 8px; text-align: left; border-bottom: 2px solid #E8E8E8; white-space: nowrap; }
        .analysis-table td { padding: 10px 8px; border-bottom: 1px solid #F0F0F0; }
        .analysis-table tr:hover td { background: #faf5f5; }
        @media (max-width: 768px) {
          .analysis-root { padding: 0 16px 24px; }
          .analysis-grid2, .analysis-grid3 { grid-template-columns: 1fr; }
          .analysis-card { padding: 16px; }
          .analysis-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        }
      `}</style>

      <div className="analysis-root" style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.5s ease' }}>
        {/* Header */}
        <div style={{ marginBottom: 24, marginTop: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1a2e', marginBottom: 4, fontFamily: "'Cormorant Garamond', serif", letterSpacing: '-0.01em' }}>
              Analysis
            </h1>
            <p style={{ fontSize: '0.82rem', color: '#8E8E93' }}>담당/부서/거래처별 출고 {isWine ? '와인' : '리델'} 분석</p>
          </div>
          {/* CDV / DL 토글 */}
          <div style={{
            display: 'flex',
            background: '#F0EFED',
            borderRadius: 8,
            padding: 2,
            flexShrink: 0,
          }}>
            {(['wine', 'glass'] as const).map(t => (
              <button
                key={t}
                onClick={() => handleTypeChange(t)}
                style={{
                  padding: '5px 14px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: type === t ? 'white' : 'transparent',
                  color: type === t ? '#5A1515' : '#999',
                  boxShadow: type === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {t === 'wine' ? 'CDV' : 'DL'}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Card */}
        <div className="analysis-card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
            {/* 담당 */}
            <div style={{ flex: '1 1 100px', minWidth: 80 }}>
              <label style={{ fontSize: '0.65rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: 3 }}>담당</label>
              <select
                value={manager}
                onChange={e => setManager(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 16, background: '#fff', color: '#333' }}
              >
                <option value="">전체</option>
                {filters.managers.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* 부서 */}
            <div style={{ flex: '1 1 100px', minWidth: 80 }}>
              <label style={{ fontSize: '0.65rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: 3 }}>부서</label>
              <select
                value={department}
                onChange={e => setDepartment(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 16, background: '#fff', color: '#333' }}
              >
                <option value="">전체</option>
                {filters.departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* 기간 */}
            <div style={{ flex: '1 1 110px', minWidth: 100 }}>
              <label style={{ fontSize: '0.65rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: 3 }}>시작</label>
              <input
                type="date"
                value={startDate}
                min={dateRange?.min || ''}
                max={endDate || dateRange?.max || ''}
                onChange={e => setStartDate(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 16, background: '#fff', color: '#333', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: '1 1 110px', minWidth: 100 }}>
              <label style={{ fontSize: '0.65rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: 3 }}>종료</label>
              <input
                type="date"
                value={endDate}
                min={startDate || dateRange?.min || ''}
                max={dateRange?.max || ''}
                onChange={e => setEndDate(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 16, background: '#fff', color: '#333', boxSizing: 'border-box' }}
              />
            </div>

            {/* 거래처 */}
            <div ref={suggestRef} style={{ flex: '1 1 140px', minWidth: 120, position: 'relative' }}>
              <label style={{ fontSize: '0.65rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: 3 }}>거래처</label>
              <input
                type="text"
                value={clientSearch}
                onChange={e => handleClientSearch(e.target.value)}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                placeholder="검색..."
                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 16, background: '#fff', color: '#333', boxSizing: 'border-box' }}
              />
              {clientCode && (
                <button
                  onClick={() => { setClientCode(''); setClientName(''); setClientSearch(''); }}
                  style={{ position: 'absolute', right: 6, top: 22, background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: '0.85rem' }}
                >x</button>
              )}
              {showSuggestions && suggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  background: '#fff', border: '1px solid #ddd', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                  maxHeight: 240, overflowY: 'auto',
                }}>
                  {suggestions.map(s => (
                    <div
                      key={s.code}
                      onClick={() => selectClient(s)}
                      style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '0.82rem', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#faf5f5')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                    >
                      <span style={{ color: '#333' }}>{s.name}</span>
                      <span style={{ color: '#999', fontSize: '0.72rem' }}>{s.code}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 조회 */}
            <div style={{ flex: '0 0 auto', background: '#F0EFED', borderRadius: 6, padding: 2 }}>
              <button
                onClick={loadData}
                disabled={loading}
                style={{
                  padding: '5px 12px', borderRadius: 5, border: 'none',
                  background: 'white', color: '#5A1515',
                  fontWeight: 600, fontSize: '0.72rem', cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  transition: 'all 0.2s ease',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? '조회중' : '조회'}
              </button>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #eee', borderTopColor: '#5A1515', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ fontSize: '0.82rem' }}>데이터 분석 중...</p>
          </div>
        )}

        {/* Data */}
        {data && !loading && (
          <>
            {/* Filter label */}
            {filterLabel && (
              <p style={{ fontSize: '0.75rem', color: '#8E8E93', marginBottom: 16 }}>{filterLabel}</p>
            )}

            {/* Summary Cards */}
            <div className="analysis-grid2" style={{ marginBottom: 20 }}>
              <div className="analysis-card">
                <div style={{ fontSize: '0.72rem', color: '#999', fontWeight: 500, marginBottom: 8 }}>총 매출</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e' }}>
                  {fmtFull(data.summary?.totalRevenue || 0)}
                </div>
              </div>
              <div className="analysis-card">
                <div style={{ fontSize: '0.72rem', color: '#999', fontWeight: 500, marginBottom: 8 }}>평균 할인률</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e' }}>
                  {(data.summary?.avgDiscount || 0).toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#1a1a2e', marginBottom: 12 }}>출고 {isWine ? '와인' : '리델'} 분석</div>
            <div className="analysis-grid2" style={{ marginBottom: 20 }}>
              {/* 국가별 도넛 (CDV only) */}
              {isWine && (
                <div className="analysis-card">
                  <div className="analysis-chart-title">국가별 매출</div>
                  {data.byCountry?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={data.byCountry} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`} style={{ fontSize: '0.7rem' }}>
                          {data.byCountry.map((_: unknown, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmtFull(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <EmptyChart />}
                </div>
              )}

              {/* 지역별 가로막대 (CDV only) */}
              {isWine && (
                <div className="analysis-card">
                  <div className="analysis-chart-title">지역별 매출 (TOP 10)</div>
                  {data.byRegion?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={data.byRegion} layout="vertical" margin={{ left: 80, right: 10, top: 0, bottom: 0 }}>
                        <XAxis type="number" tickFormatter={fmt} style={{ fontSize: '0.7rem' }} />
                        <YAxis type="category" dataKey="name" width={75} style={{ fontSize: '0.68rem' }} />
                        <Tooltip formatter={(v: number) => fmtFull(v)} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {data.byRegion.map((_: unknown, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <EmptyChart />}
                </div>
              )}

              {/* 타입별 도넛 (CDV only) */}
              {isWine && (
                <div className="analysis-card">
                  <div className="analysis-chart-title">타입별 매출</div>
                  {data.byType?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={data.byType} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`} style={{ fontSize: '0.7rem' }}>
                          {data.byType.map((_: unknown, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmtFull(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <EmptyChart />}
                </div>
              )}

              {/* 품종별 가로막대 (CDV only) */}
              {isWine && (
                <div className="analysis-card">
                  <div className="analysis-chart-title">품종별 매출 (TOP 10)</div>
                  {data.byGrape?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={data.byGrape} layout="vertical" margin={{ left: 100, right: 10, top: 0, bottom: 0 }}>
                        <XAxis type="number" tickFormatter={fmt} style={{ fontSize: '0.7rem' }} />
                        <YAxis type="category" dataKey="name" width={95} style={{ fontSize: '0.68rem' }} />
                        <Tooltip formatter={(v: number) => fmtFull(v)} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {data.byGrape.map((_: unknown, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <EmptyChart />}
                </div>
              )}

              {/* 가격대별 히스토그램 */}
              <div className="analysis-card" style={{ gridColumn: isWine ? 'span 2' : undefined }}>
                <div className="analysis-chart-title">가격대별 분포</div>
                {data.byPrice?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.byPrice} margin={{ left: 10, right: 10, top: 0, bottom: 0 }}>
                      <XAxis dataKey="band" tickFormatter={(v: number) => v >= 10000 ? `${(v/10000).toFixed(0)}만` : `${v}`} style={{ fontSize: '0.7rem' }} />
                      <YAxis tickFormatter={fmt} style={{ fontSize: '0.7rem' }} />
                      <Tooltip
                        formatter={(v: number, name: string) => [name === 'value' ? fmtFull(v) : `${v}종`, name === 'value' ? '매출' : '품목수']}
                        labelFormatter={(v: number) => `공급가 ${(v/10000).toFixed(0)}만원대`}
                      />
                      <Legend />
                      <Bar dataKey="value" name="매출" fill="#9B6B8A" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="cnt" name="품목수" fill="#C4A882" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </div>
            </div>

            {/* Item Ranking Table */}
            <div className="analysis-card">
              <div className="analysis-chart-title" style={{ marginBottom: 16 }}>품목별 매출 순위</div>
              <div className="analysis-table-wrap">
                <table className="analysis-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40, textAlign: 'center' }}>#</th>
                      <th style={{ width: 50 }}>변동</th>
                      <th style={{ width: 80 }}>코드</th>
                      <th>품목명</th>
                      <th style={{ textAlign: 'right' }}>매출</th>
                      <th style={{ textAlign: 'right', width: 65 }}>할인률</th>
                      <th style={{ textAlign: 'right', width: 50 }}>수량</th>
                      <th style={{ textAlign: 'right', width: 60 }}>재고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.itemRanking || []).map((item: { rn: number; code: string; name: string; revenue: number; discount: number; quantity: number; stock: number }, idx: number) => {
                      const prevRank = data.prevRanking?.[item.code];
                      let changeEl: React.ReactNode = <span style={{ color: '#999' }}>-</span>;
                      if (prevRank) {
                        const diff = prevRank - item.rn;
                        if (diff > 0) changeEl = <span style={{ color: '#059669', fontWeight: 600 }}>{'\u25B2'}{diff}</span>;
                        else if (diff < 0) changeEl = <span style={{ color: '#DC2626', fontWeight: 600 }}>{'\u25BC'}{Math.abs(diff)}</span>;
                        else changeEl = <span style={{ color: '#999' }}>-</span>;
                      } else if (data.prevRanking && !prevRank) {
                        changeEl = <span style={{ color: '#2563eb', fontWeight: 600, fontSize: '0.7rem' }}>NEW</span>;
                      }
                      return (
                        <tr key={item.code || idx}>
                          <td style={{ textAlign: 'center', fontWeight: 600, color: item.rn <= 3 ? '#5A1515' : '#666' }}>{item.rn}</td>
                          <td>{changeEl}</td>
                          <td style={{ fontSize: '0.72rem', color: '#999' }}>{item.code}</td>
                          <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</td>
                          <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmt(item.revenue)}</td>
                          <td style={{ textAlign: 'right', color: item.discount > 0 ? '#DC2626' : '#333' }}>{item.discount ? `${item.discount}%` : '-'}</td>
                          <td style={{ textAlign: 'right' }}>{item.quantity}</td>
                          <td style={{ textAlign: 'right', color: item.stock <= 0 ? '#DC2626' : '#333' }}>{item.stock}</td>
                        </tr>
                      );
                    })}
                    {(!data.itemRanking || data.itemRanking.length === 0) && (
                      <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#999' }}>데이터 없음</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function EmptyChart() {
  return (
    <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: '0.82rem' }}>
      데이터 없음
    </div>
  );
}
