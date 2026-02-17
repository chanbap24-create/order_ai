'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Cell } from 'recharts';
import RecommendTab from './RecommendTab';

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

interface SuggestionItem { code: string; name: string; }

interface SelectedRankClient {
  client_code: string;
  client_name: string;
  importance: number;
  manager: string | null;
  business_type: string | null;
  client_type?: string;
}

export default function AnalysisTab({ currentManager, isAdmin }: { currentManager: string; isAdmin: boolean }) {
  const [selectedClient, setSelectedClient] = useState<SelectedRankClient | null>(null);

  if (selectedClient) {
    return (
      <ClientDetailPanel
        client={selectedClient}
        currentManager={currentManager}
        isAdmin={isAdmin}
        onBack={() => setSelectedClient(null)}
      />
    );
  }

  return (
    <AnalysisSection
      currentManager={currentManager}
      isAdmin={isAdmin}
      onSelectClient={setSelectedClient}
    />
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   매출 분석 섹션 (기존 AnalysisTab 그대로)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function AnalysisSection({ currentManager, isAdmin, onSelectClient }: { currentManager: string; isAdmin: boolean; onSelectClient: (client: SelectedRankClient) => void }) {
  const [type, setType] = useState<'wine' | 'glass'>('wine');
  const [filters, setFilters] = useState<{ managers: string[]; departments: string[] }>({ managers: [], departments: [] });
  const [dateRange, setDateRange] = useState<{ min: string; max: string } | null>(null);
  const [manager, setManager] = useState(isAdmin ? '' : currentManager);
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

  // ── Client ranking state ──
  interface ClientRankItem {
    client_code: string;
    client_name: string;
    importance: number;
    manager: string | null;
    business_type: string | null;
  }
  interface ClientRankStats {
    totalSales: number;
    lastShipDate: string | null;
    orderCount: number;
    changeRate: number;
  }
  const [rankClients, setRankClients] = useState<ClientRankItem[]>([]);
  const [rankStats, setRankStats] = useState<Record<string, ClientRankStats>>({});
  const [rankLoading, setRankLoading] = useState(false);

  const isWine = type === 'wine';

  useEffect(() => { setMounted(true); }, []);

  // ── Fetch client ranking data ──
  const fetchClientRanking = useCallback(async () => {
    setRankLoading(true);
    try {
      const params = new URLSearchParams({ type, limit: '9999' });
      const mgr = isAdmin ? manager : currentManager;
      if (mgr) params.set('manager', mgr);
      const [clientRes, statsRes] = await Promise.all([
        fetch(`/api/sales/clients?${params}`),
        fetch(`/api/sales/clients/stats?type=${type}`),
      ]);
      const clientJson = await clientRes.json();
      const statsJson = await statsRes.json();
      if (clientJson.clients) setRankClients(clientJson.clients);
      if (statsJson.stats) setRankStats(statsJson.stats);
    } catch (err) { console.error('Failed to fetch client ranking:', err); }
    finally { setRankLoading(false); }
  }, [type, manager, isAdmin, currentManager]);

  useEffect(() => { fetchClientRanking(); }, [fetchClientRanking]);

  const handleTypeChange = (t: 'wine' | 'glass') => {
    setType(t);
    if (isAdmin) setManager('');
    setDepartment('');
    setClientSearch(''); setClientCode(''); setClientName('');
    setSuggestions([]); setShowSuggestions(false);
    setData(null);
  };

  useEffect(() => {
    fetch(`/api/analysis/client?filters=1&type=${type}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setFilters({ managers: d.managers || [], departments: d.departments || [] });
          if (d.dateRange) setDateRange(d.dateRange);
        }
      });
  }, [type]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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

  const loadData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('type', type);
    const mgr = isAdmin ? manager : currentManager;
    if (mgr) params.set('manager', mgr);
    if (department) params.set('department', department);
    if (clientCode) params.set('client', clientCode);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    fetch(`/api/analysis/client?${params}`)
      .then(r => r.json())
      .then(d => { if (d.success) setData(d); })
      .finally(() => setLoading(false));
  }, [type, manager, department, clientCode, startDate, endDate, isAdmin, currentManager]);

  useEffect(() => {
    loadData();
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  const filterLabel = [
    (isAdmin ? manager : currentManager) && `담당: ${isAdmin ? manager : currentManager}`,
    department && `부서: ${department}`,
    clientName && `거래처: ${clientName}`,
  ].filter(Boolean).join(' / ');

  return (
    <>
      <style>{`
        .analysis-card { background: #fff; border: 1px solid #E8E8E8; border-radius: 12px; padding: 20px; }
        .analysis-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .analysis-chart-title { font-size: 0.82rem; font-weight: 600; color: #333; margin-bottom: 12px; }
        .analysis-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
        .analysis-table th { background: #faf5f5; color: #5A1515; font-weight: 600; padding: 10px 8px; text-align: left; border-bottom: 2px solid #E8E8E8; white-space: nowrap; }
        .analysis-table td { padding: 10px 8px; border-bottom: 1px solid #F0F0F0; }
        .analysis-table tr:hover td { background: #faf5f5; }
        @media (max-width: 768px) {
          .analysis-grid2 { grid-template-columns: 1fr; }
          .analysis-card { padding: 16px; }
          .analysis-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        }
      `}</style>

      <div style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.5s ease' }}>
        {/* CDV / DL 토글 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: '0.82rem', color: '#8E8E93' }}>
            {isAdmin ? '담당/부서/거래처별' : `${currentManager} 담당`} 출고 {isWine ? '와인' : '리델'} 분석
          </div>
          <div style={{ display: 'flex', background: '#F0EFED', borderRadius: 8, padding: 2, flexShrink: 0 }}>
            {(['wine', 'glass'] as const).map(t => (
              <button
                key={t}
                onClick={() => handleTypeChange(t)}
                style={{
                  padding: '5px 14px', borderRadius: 6, border: 'none',
                  fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
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
            {isAdmin && (
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
            )}
            <div style={{ flex: '1 1 110px', minWidth: 100 }}>
              <label style={{ fontSize: '0.65rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: 3 }}>시작</label>
              <input type="date" value={startDate} min={dateRange?.min || ''} max={endDate || dateRange?.max || ''} onChange={e => setStartDate(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 16, background: '#fff', color: '#333', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: '1 1 110px', minWidth: 100 }}>
              <label style={{ fontSize: '0.65rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: 3 }}>종료</label>
              <input type="date" value={endDate} min={startDate || dateRange?.min || ''} max={dateRange?.max || ''} onChange={e => setEndDate(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 16, background: '#fff', color: '#333', boxSizing: 'border-box' }} />
            </div>
            <div ref={suggestRef} style={{ flex: '1 1 140px', minWidth: 120, position: 'relative' }}>
              <label style={{ fontSize: '0.65rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: 3 }}>거래처</label>
              <input type="text" value={clientSearch} onChange={e => handleClientSearch(e.target.value)} onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                placeholder="검색..." style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 16, background: '#fff', color: '#333', boxSizing: 'border-box' }} />
              {clientCode && (
                <button onClick={() => { setClientCode(''); setClientName(''); setClientSearch(''); }}
                  style={{ position: 'absolute', right: 6, top: 22, background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: '0.85rem' }}>x</button>
              )}
              {showSuggestions && suggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff', border: '1px solid #ddd', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', maxHeight: 240, overflowY: 'auto' }}>
                  {suggestions.map(s => (
                    <div key={s.code} onClick={() => selectClient(s)}
                      style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '0.82rem', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#faf5f5')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                      <span style={{ color: '#333' }}>{s.name}</span>
                      <span style={{ color: '#999', fontSize: '0.72rem' }}>{s.code}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ flex: '0 0 auto', background: '#F0EFED', borderRadius: 6, padding: 2 }}>
              <button onClick={loadData} disabled={loading}
                style={{ padding: '5px 12px', borderRadius: 5, border: 'none', background: 'white', color: '#5A1515', fontWeight: 600, fontSize: '0.72rem', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', transition: 'all 0.2s ease', opacity: loading ? 0.6 : 1 }}>
                {loading ? '조회중' : '조회'}
              </button>
            </div>
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #eee', borderTopColor: '#5A1515', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ fontSize: '0.82rem' }}>데이터 분석 중...</p>
          </div>
        )}

        {data && !loading && (
          <>
            {filterLabel && <p style={{ fontSize: '0.75rem', color: '#8E8E93', marginBottom: 16 }}>{filterLabel}</p>}
            <div className="analysis-grid2" style={{ marginBottom: 20 }}>
              <div className="analysis-card">
                <div style={{ fontSize: '0.72rem', color: '#999', fontWeight: 500, marginBottom: 8 }}>총 매출</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e' }}>{fmtFull(data.summary?.totalRevenue || 0)}</div>
              </div>
              <div className="analysis-card">
                <div style={{ fontSize: '0.72rem', color: '#999', fontWeight: 500, marginBottom: 8 }}>평균 할인률</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e' }}>{(data.summary?.avgDiscount || 0).toFixed(1)}%</div>
              </div>
            </div>
            <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#1a1a2e', marginBottom: 12 }}>출고 {isWine ? '와인' : '리델'} 분석</div>
            <div className="analysis-grid2" style={{ marginBottom: 20 }}>
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
            </div>
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

            {/* ── 거래처 매출 순위 ── */}
            <div className="analysis-card" style={{ marginTop: 20 }}>
              <div className="analysis-chart-title" style={{ marginBottom: 16 }}>거래처 매출 순위</div>
              {rankLoading ? (
                <div style={{ textAlign: 'center', padding: 24, color: '#999', fontSize: 13 }}>거래처 데이터 로딩 중...</div>
              ) : (() => {
                const RANK_IMP: Record<number, { label: string; color: string }> = {
                  1: { label: 'VIP', color: '#dc3545' },
                  2: { label: '중요', color: '#fd7e14' },
                  3: { label: '일반', color: '#6c757d' },
                  4: { label: '간헐', color: '#adb5bd' },
                  5: { label: '비활성', color: '#dee2e6' },
                };
                const sorted = [...rankClients]
                  .map(c => ({ ...c, st: rankStats[c.client_code] }))
                  .sort((a, b) => (b.st?.totalSales || 0) - (a.st?.totalSales || 0))
                  .slice(0, 30);
                if (sorted.length === 0) return (
                  <div style={{ textAlign: 'center', padding: 32, color: '#999', fontSize: 13 }}>데이터 없음</div>
                );
                return (
                  <div className="analysis-table-wrap">
                    <table className="analysis-table">
                      <thead>
                        <tr>
                          <th style={{ width: 40, textAlign: 'center' }}>#</th>
                          <th style={{ width: 50 }}>등급</th>
                          <th>거래처명</th>
                          <th style={{ width: 70 }}>담당</th>
                          <th style={{ textAlign: 'right' }}>매출</th>
                          <th style={{ textAlign: 'right', width: 50 }}>건수</th>
                          <th style={{ textAlign: 'right', width: 60 }}>전기비</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((c, idx) => {
                          const imp = RANK_IMP[c.importance] || RANK_IMP[3];
                          const cr = c.st?.changeRate ?? 0;
                          return (
                            <tr key={c.client_code} onClick={() => onSelectClient({ client_code: c.client_code, client_name: c.client_name, importance: c.importance, manager: c.manager, business_type: c.business_type })} style={{ cursor: 'pointer' }}>
                              <td style={{ textAlign: 'center', fontWeight: 600, color: idx < 3 ? '#5A1515' : '#666' }}>{idx + 1}</td>
                              <td>
                                <span style={{
                                  fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                                  color: imp.color, background: imp.color + '14', border: `1px solid ${imp.color}25`,
                                }}>
                                  {imp.label}
                                </span>
                              </td>
                              <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.client_name}</td>
                              <td style={{ fontSize: '0.72rem', color: '#999' }}>{c.manager || '-'}</td>
                              <td style={{ textAlign: 'right', fontWeight: 500 }}>{c.st ? fmt(c.st.totalSales) : '-'}</td>
                              <td style={{ textAlign: 'right' }}>{c.st?.orderCount || 0}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: cr > 0 ? '#059669' : cr < 0 ? '#DC2626' : '#999' }}>
                                {cr !== 0 ? `${cr > 0 ? '+' : ''}${cr}%` : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* ── 가격대별 분포 ── */}
            <div className="analysis-card" style={{ marginTop: 20 }}>
              <div className="analysis-chart-title">가격대별 분포</div>
              {data.byPrice?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.byPrice} margin={{ left: 10, right: 10, top: 0, bottom: 0 }}>
                    <XAxis dataKey="band" tickFormatter={(v: number) => v >= 10000 ? `${(v/10000).toFixed(0)}만` : `${v}`} style={{ fontSize: '0.7rem' }} />
                    <YAxis tickFormatter={fmt} style={{ fontSize: '0.7rem' }} />
                    <Tooltip formatter={(v: number, name: string) => [name === 'value' ? fmtFull(v) : `${v}종`, name === 'value' ? '매출' : '품목수']} labelFormatter={(v: number) => `공급가 ${(v/10000).toFixed(0)}만원대`} />
                    <Legend />
                    <Bar dataKey="value" name="매출" fill="#9B6B8A" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cnt" name="품목수" fill="#C4A882" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   거래처 상세 패널 (거래처 관리 + AI 추천)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

interface ClientDetail {
  client_code: string;
  client_name: string;
  client_type: string;
  importance: number;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  business_type: string | null;
  manager: string | null;
  memo: string | null;
  visit_cycle_days: number;
  last_visit_date: string | null;
  next_visit_date: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

const IMPORTANCE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'VIP', color: '#dc3545' },
  2: { label: '중요', color: '#fd7e14' },
  3: { label: '일반', color: '#6c757d' },
  4: { label: '간헐', color: '#adb5bd' },
  5: { label: '비활성', color: '#dee2e6' },
};

const BUSINESS_TYPES = [
  'on/업소', 'on/샵', 'on/도매장', 'on/호텔',
  'off/편의점', 'off/할인점', 'off/백화점',
  '백화점(와인)', '백화점(리빙)', 'etc/기타',
  '업소', '샵', '호텔', '기물벤더', '온라인',
  '수입사', '와인도매장', '기업특판', '할인점', '리빙샵', '기타',
];

function ClientDetailPanel({ client, currentManager, isAdmin, onBack }: {
  client: SelectedRankClient;
  currentManager: string;
  isAdmin: boolean;
  onBack: () => void;
}) {
  const [subTab, setSubTab] = useState<'info' | 'recommend'>('info');
  const [clientDetail, setClientDetail] = useState<ClientDetail | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<ClientDetail>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [detailStats, setDetailStats] = useState<{ totalSales: number; lastShipDate: string | null; recentShipments: any[]; itemStats: any[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [importance, setImportance] = useState(client.importance);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [prefs, setPrefs] = useState<{ priceRanges: any[]; regions: any[]; brands: any[]; grapes: any[]; tastes: any[] } | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(true);

  // ── 거래처 상세 정보 로드 ──
  useEffect(() => {
    setDetailLoading(true);
    Promise.all([
      fetch(`/api/sales/clients?search=${encodeURIComponent(client.client_code)}&limit=1`).then(r => r.json()),
      fetch(`/api/sales/clients/stats?code=${client.client_code}`).then(r => r.json()),
    ]).then(([clientJson, statsJson]) => {
      if (clientJson.clients?.[0]) setClientDetail(clientJson.clients[0]);
      if (statsJson.totalSales !== undefined) setDetailStats(statsJson);
    }).catch(err => console.error('Failed to load client detail:', err))
      .finally(() => setDetailLoading(false));
    // 선호 분석 로드
    setPrefsLoading(true);
    fetch(`/api/sales/clients/preferences?code=${client.client_code}`)
      .then(r => r.json())
      .then(data => { if (!data.error) setPrefs(data); })
      .catch(err => console.error('Preferences load error:', err))
      .finally(() => setPrefsLoading(false));
  }, [client.client_code]);

  const quickSetImportance = async (n: number) => {
    try {
      await fetch('/api/sales/clients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_code: client.client_code, importance: n }),
      });
      setImportance(n);
      if (clientDetail) setClientDetail({ ...clientDetail, importance: n });
    } catch (err) { console.error('Importance update error:', err); }
  };

  const handleSave = async () => {
    if (!clientDetail) return;
    try {
      const res = await fetch('/api/sales/clients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_code: client.client_code, ...editData }),
      });
      const json = await res.json();
      if (json.success) {
        setClientDetail({ ...clientDetail, ...editData } as ClientDetail);
        setEditMode(false); setEditData({});
      }
    } catch (err) { console.error('Save error:', err); }
  };

  const imp = IMPORTANCE_LABELS[importance] || IMPORTANCE_LABELS[3];
  const c = clientDetail;

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#666', display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>{client.client_name}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: imp.color, background: imp.color + '15', padding: '2px 8px', borderRadius: 4 }}>{imp.label}</span>
            <span style={{ fontSize: 12, color: '#999' }}>{client.client_code}</span>
          </div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
            {client.manager && `담당: ${client.manager}`}
            {client.business_type && ` · ${client.business_type}`}
          </div>
        </div>
      </div>

      {/* 등급 변경 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[1, 2, 3, 4, 5].map(n => {
          const info = IMPORTANCE_LABELS[n];
          const isActive = importance === n;
          return (
            <button key={n} onClick={() => quickSetImportance(n)}
              style={{ padding: '4px 12px', borderRadius: 4, border: `1px solid ${isActive ? info.color : '#eee'}`, background: isActive ? info.color + '15' : 'white', color: isActive ? info.color : '#999', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {info.label}
            </button>
          );
        })}
      </div>

      {/* 서브 탭: 거래처 정보 / AI 추천 */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16 }}>
        {([['info', '거래처 정보'], ['recommend', 'AI 추천']] as const).map(([id, label]) => {
          const active = subTab === id;
          return (
            <button key={id} onClick={() => setSubTab(id)}
              style={{ flex: 1, padding: '10px 0', border: 'none', borderBottom: `2px solid ${active ? '#5A1515' : '#eee'}`, background: active ? '#5A151508' : 'transparent', color: active ? '#5A1515' : '#999', fontSize: 14, fontWeight: active ? 700 : 500, cursor: 'pointer', transition: 'all 0.2s ease' }}>
              {label}
            </button>
          );
        })}
      </div>

      {subTab === 'info' && (
        <>
          {detailLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>로딩 중...</div>
          ) : (
            <>
              {/* 연락처 정보 */}
              {c && (
                <div style={{ background: 'white', borderRadius: 8, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>연락처 정보</div>
                    <button onClick={() => { setEditMode(!editMode); setEditData({}); }}
                      style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #ddd', background: editMode ? '#5A1515' : 'white', color: editMode ? 'white' : '#666', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                      {editMode ? '취소' : '편집'}
                    </button>
                  </div>
                  {editMode ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {renderEditField('담당자', 'contact_name', c.contact_name)}
                      {renderEditField('전화번호', 'contact_phone', c.contact_phone)}
                      {renderEditField('이메일', 'contact_email', c.contact_email)}
                      {renderEditField('주소', 'address', c.address)}
                      <div>
                        <label style={{ fontSize: 11, color: '#999', display: 'block', marginBottom: 4 }}>업종</label>
                        <select value={editData.business_type ?? c.business_type ?? ''} onChange={e => setEditData({ ...editData, business_type: e.target.value })}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 16, background: 'white' }}>
                          <option value="">선택</option>
                          {BUSINESS_TYPES.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                        </select>
                      </div>
                      {renderEditField('담당자(우리)', 'manager', c.manager)}
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: 11, color: '#999', display: 'block', marginBottom: 4 }}>메모</label>
                        <textarea value={editData.memo ?? c.memo ?? ''} onChange={e => setEditData({ ...editData, memo: e.target.value })} rows={3}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 16, resize: 'vertical' }} />
                      </div>
                      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={handleSave}
                          style={{ padding: '8px 24px', borderRadius: 6, border: 'none', background: '#5A1515', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                          저장
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
                      {renderInfoField('담당자', c.contact_name)}
                      {renderInfoField('전화번호', c.contact_phone)}
                      {renderInfoField('이메일', c.contact_email)}
                      {renderInfoField('주소', c.address)}
                      {renderInfoField('업종', c.business_type)}
                      {renderInfoField('담당자(우리)', c.manager)}
                      <div style={{ gridColumn: '1 / -1' }}>{renderInfoField('메모', c.memo)}</div>
                    </div>
                  )}
                </div>
              )}

              {/* 매출 현황 */}
              <div style={{ background: 'white', borderRadius: 8, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', marginBottom: 12 }}>매출 현황 (최근 1년)</div>
                {detailStats ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                      <div style={{ textAlign: 'center', padding: '12px 0', background: '#f8f7f5', borderRadius: 6 }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#5A1515' }}>{fmt(detailStats.totalSales)}</div>
                        <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>총 매출</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '12px 0', background: '#f8f7f5', borderRadius: 6 }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e' }}>{detailStats.itemStats?.length || 0}</div>
                        <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>구매 품목 수</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '12px 0', background: '#f8f7f5', borderRadius: 6 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{detailStats.lastShipDate || '-'}</div>
                        <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>최근 출고일</div>
                      </div>
                    </div>
                    {detailStats.itemStats && detailStats.itemStats.length > 0 && (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 8 }}>주요 구매 품목</div>
                        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                          {detailStats.itemStats.slice(0, 10).map((item: { item_no: string; item_name: string; buy_count: number; avg_price: number }) => (
                            <div key={item.item_no} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
                              <span style={{ flex: 1, color: '#333' }}>{item.item_name}</span>
                              <span style={{ color: '#999', fontSize: 12 }}>{item.buy_count}회</span>
                              <span style={{ color: '#5A1515', fontWeight: 600, fontSize: 12 }}>{item.avg_price ? fmt(item.avg_price) : '-'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {detailStats.recentShipments && detailStats.recentShipments.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 8 }}>최근 출고</div>
                        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                          {detailStats.recentShipments.slice(0, 10).map((s: { item_name: string; quantity: number; total_amount: number; ship_date: string }, i: number) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
                              <span style={{ fontSize: 11, color: '#aaa', width: 72 }}>{s.ship_date?.toString().slice(0, 10)}</span>
                              <span style={{ flex: 1, color: '#333' }}>{s.item_name}</span>
                              <span style={{ color: '#999', fontSize: 12 }}>{s.quantity}개</span>
                              <span style={{ color: '#5A1515', fontWeight: 600, fontSize: 12 }}>{s.total_amount ? fmt(s.total_amount) : '-'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ color: '#999', fontSize: 13 }}>출고 이력 없음</div>
                )}
              </div>

              {/* 선호 분석 차트 */}
              <PreferenceCharts prefs={prefs} loading={prefsLoading} />

              {/* 태그 */}
              {c && (
                <div style={{ background: 'white', borderRadius: 8, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', marginBottom: 12 }}>태그</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(c.tags || []).map((tag, i) => (
                      <span key={i} style={{ padding: '4px 10px', borderRadius: 12, background: '#f0ece6', color: '#5A1515', fontSize: 12, fontWeight: 500 }}>{tag}</span>
                    ))}
                    {(!c.tags || c.tags.length === 0) && <span style={{ fontSize: 12, color: '#ccc' }}>태그 없음</span>}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {subTab === 'recommend' && (
        <RecommendTab
          currentManager={currentManager}
          isAdmin={isAdmin}
          preselectedClient={{ client_code: client.client_code, client_name: client.client_name, importance, manager: client.manager || undefined, business_type: client.business_type || undefined }}
        />
      )}
    </div>
  );

  function renderInfoField(label: string, value: string | null | undefined) {
    return (
      <div>
        <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 14, color: value ? '#333' : '#ccc' }}>{value || '-'}</div>
      </div>
    );
  }

  function renderEditField(label: string, field: keyof ClientDetail, currentValue: string | null | undefined) {
    return (
      <div>
        <label style={{ fontSize: 11, color: '#999', display: 'block', marginBottom: 4 }}>{label}</label>
        <input type="text" value={(editData[field] as string) ?? currentValue ?? ''} onChange={e => setEditData({ ...editData, [field]: e.target.value })}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 16 }} />
      </div>
    );
  }
}

const PREF_COLORS = ['#9B6B8A', '#7B9EA8', '#C4A882', '#8FAD88', '#B08EA2', '#A8886E', '#7E9BB5', '#C49B8A'];
const TASTE_COLORS: Record<string, string> = {
  '과일향': '#E8726E', '꽃향': '#F5A0C0', '오크/바닐라': '#D4A76A', '스파이스': '#C97B4B',
  '미네랄': '#8BAEC4', '견과류': '#B09070', '허브': '#7DB88F', '초콜릿/커피': '#7A5C4F',
  '흙/가죽': '#8B7D6B', '꿀/달콤': '#E8C36A',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PreferenceCharts({ prefs, loading }: { prefs: any | null; loading: boolean }) {
  if (loading) return <div style={{ textAlign: 'center', padding: 30, color: '#999', fontSize: 13 }}>선호 분석 로딩 중...</div>;
  if (!prefs) return null;
  const hasData = prefs.priceRanges?.length || prefs.regions?.length || prefs.brands?.length || prefs.grapes?.length || prefs.tastes?.length;
  if (!hasData) return null;

  return (
    <div style={{ background: 'white', borderRadius: 8, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', marginBottom: 16 }}>선호 분석 (최근 1년)</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {/* 가격대별 */}
        {prefs.priceRanges?.length > 0 && (
          <PrefBarSection title="선호 가격대" data={prefs.priceRanges} nameKey="label" valueKey="amt" />
        )}
        {/* 지역별 */}
        {prefs.regions?.length > 0 && (
          <PrefBarSection title="선호 지역" data={prefs.regions} nameKey="name" valueKey="amt" />
        )}
        {/* 브랜드별 */}
        {prefs.brands?.length > 0 && (
          <PrefBarSection title="선호 브랜드" data={prefs.brands} nameKey="name" valueKey="amt" />
        )}
        {/* 품종별 */}
        {prefs.grapes?.length > 0 && (
          <PrefBarSection title="선호 품종" data={prefs.grapes} nameKey="name" valueKey="amt" />
        )}
      </div>

      {/* 테이스트 프로필 - 레이더 스타일 바 */}
      {prefs.tastes?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 12 }}>선호 테이스트 프로필</div>
          <TasteProfile tastes={prefs.tastes} />
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PrefBarSection({ title, data, nameKey, valueKey }: { title: string; data: any[]; nameKey: string; valueKey: string }) {
  const maxVal = Math.max(...data.map(d => d[valueKey] || 0), 1);
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.map((item, i) => {
          const val = item[valueKey] || 0;
          const pct = (val / maxVal) * 100;
          return (
            <div key={item[nameKey]} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 80, fontSize: 12, color: '#555', fontWeight: 500, textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item[nameKey]}
              </div>
              <div style={{ flex: 1, height: 20, background: '#f5f4f2', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  width: `${Math.max(pct, 2)}%`, height: '100%',
                  background: PREF_COLORS[i % PREF_COLORS.length],
                  borderRadius: 4, transition: 'width 0.5s ease',
                }} />
              </div>
              <div style={{ width: 56, fontSize: 11, color: '#888', textAlign: 'right', flexShrink: 0 }}>
                {val >= 1e8 ? (val / 1e8).toFixed(1) + '억' : val >= 1e4 ? Math.round(val / 1e4) + '만' : val.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TasteProfile({ tastes }: { tastes: { name: string; count: number; qty: number }[] }) {
  const maxQty = Math.max(...tastes.map(t => t.qty), 1);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {tastes.map(t => {
        const pct = Math.round((t.qty / maxQty) * 100);
        const color = TASTE_COLORS[t.name] || '#999';
        return (
          <div key={t.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 72 }}>
            {/* 원형 비율 표시 */}
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: `conic-gradient(${color} ${pct * 3.6}deg, #f0ece6 ${pct * 3.6}deg)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 4,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%', background: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color,
              }}>
                {pct}%
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#555', fontWeight: 500, textAlign: 'center', lineHeight: '1.2' }}>{t.name}</div>
            <div style={{ fontSize: 10, color: '#aaa' }}>{t.count}종</div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyChart() {
  return (
    <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: '0.82rem' }}>
      데이터 없음
    </div>
  );
}
