'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Card from '@/app/components/ui/Card';

const LineChart = dynamic(() => import('recharts').then(m => m.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then(m => m.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });

// PieChart는 Cell이 dynamic import 시 자식 인식 안 되므로 통째로 래핑
const BizPieChart = dynamic(() => import('recharts').then(mod => {
  const { PieChart, Pie, Cell, Tooltip: RTooltip, ResponsiveContainer: RC } = mod;
  function BizPie({ data: chartData, colors }: { data: Array<{ name: string; revenue: number }>; colors: string[] }) {
    return (
      <RC width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="revenue"
            nameKey="name"
            cx="50%" cy="50%"
            outerRadius={80}
            label={({ name, percent }: { name: string; percent: number }) =>
              percent > 0.05 ? `${name.length > 6 ? name.slice(0, 6) + '..' : name}` : ''
            }
            labelLine={false}
            style={{ fontSize: 10 }}
          >
            {chartData.map((_: unknown, i: number) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <RTooltip formatter={(value: number) => [`${value.toLocaleString()}원`, '매출']} />
        </PieChart>
      </RC>
    );
  }
  return BizPie;
}), { ssr: false });

const PIE_COLORS = ['#8B1538', '#4D96FF', '#6BCB77', '#FF6B6B', '#FFD93D', '#9B59B6', '#FF8C42', '#00BCD4', '#34495E', '#E91E63'];

function formatKrw(v: number) {
  if (v >= 1_0000_0000) return `${(v / 1_0000_0000).toFixed(1)}억`;
  if (v >= 1_0000) return `${Math.round(v / 1_0000).toLocaleString()}만`;
  return v.toLocaleString();
}

function formatDateShort(dateStr: string) {
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

interface Filters {
  managers: string[];
  departments: string[];
  businessTypes: string[];
  dateRange: { min: string | null; max: string | null };
}

interface AnalysisData {
  summary: { totalRevenue: number; totalQuantity: number; totalCount: number };
  clientRanking: Array<{ code: string; name: string; revenue: number; quantity: number; itemCount: number; rankChange: number | null; isNew: boolean; discountRate: number | null }>;
  managerAnalysis: Array<{
    manager: string; clientCount: number; revenue: number; discountRate: number | null;
    brands: Array<{ brand: string; revenue: number }>;
    bizClients: Array<{ biz: string; count: number }>;
  }>;
  businessAnalysis: Array<{ name: string; revenue: number }>;
  brandAnalysis: Array<{ name: string; revenue: number }>;
  dailyTrend: Array<{ date: string; revenue: number }>;
}

export default function ClientAnalysisTab() {
  const [type, setType] = useState<'wine' | 'glass'>('wine');
  const [filters, setFilters] = useState<Filters | null>(null);
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);

  // Filter state
  const [manager, setManager] = useState('');
  const [department, setDepartment] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [startDate, setStartDate] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  // 업종/브랜드 전환
  const [bizView, setBizView] = useState<'business' | 'brand'>('business');

  // 매출추이 기간 단위
  const [trendPeriod, setTrendPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Client detail bottom sheet
  const [selectedClient, setSelectedClient] = useState<{ code: string; name: string } | null>(null);
  const [clientItems, setClientItems] = useState<Array<{ item_no: string; item_name: string; quantity: number; revenue: number; count: number; supplyPrice: number | null; avgSellingPrice: number | null; discountRate: number | null }>>([]);
  const [clientDetailLoading, setClientDetailLoading] = useState(false);

  // Load filters
  useEffect(() => {
    setFilterLoading(true);
    fetch(`/api/admin/client-analysis/filters?type=${type}`)
      .then(r => r.json())
      .then(d => { if (d.success) setFilters(d); })
      .catch(() => {})
      .finally(() => setFilterLoading(false));
  }, [type]);

  // Load analysis data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type });
      if (manager) params.set('manager', manager);
      if (department) params.set('department', department);
      if (businessType) params.set('businessType', businessType);
      if (clientSearch) params.set('clientSearch', clientSearch);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`/api/admin/client-analysis?${params}`);
      const json = await res.json();
      if (json.success) setData(json);
    } catch { /* ignore */ }
    setLoading(false);
  }, [type, manager, department, businessType, clientSearch, startDate, endDate]);

  useEffect(() => { loadData(); }, [loadData]);

  const openClientDetail = async (code: string, name: string) => {
    setSelectedClient({ code, name });
    setClientDetailLoading(true);
    setClientItems([]);
    try {
      const params = new URLSearchParams({ type, clientCode: code });
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await fetch(`/api/admin/client-analysis?${params}`);
      const json = await res.json();
      if (json.success) setClientItems(json.clientItems || []);
    } catch { /* ignore */ }
    setClientDetailLoading(false);
  };

  const resetFilters = () => {
    setManager('');
    setDepartment('');
    setBusinessType('');
    setClientSearch('');
    setStartDate(`${new Date().getFullYear()}-01-01`);
    setEndDate(new Date().toISOString().slice(0, 10));
  };

  const selectStyle: React.CSSProperties = {
    height: 34, fontSize: 16, padding: '0 8px',
    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    background: 'var(--color-card)', color: 'var(--color-text)',
    minWidth: 0, flex: 1,
  };

  const inputStyle: React.CSSProperties = {
    ...selectStyle,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: 'var(--color-text-light)',
    fontWeight: 600, marginBottom: 2,
  };

  return (
    <div>
      {/* Wine/Glass Toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['wine', 'glass'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setType(t); resetFilters(); }}
            style={{
              padding: '8px 20px', borderRadius: 'var(--radius-md)',
              border: type === t ? '2px solid #8B1538' : '1px solid var(--color-border)',
              background: type === t ? 'rgba(139,21,56,0.08)' : 'var(--color-card)',
              color: type === t ? '#8B1538' : 'var(--color-text)',
              fontWeight: type === t ? 700 : 500,
              fontSize: 'var(--text-sm)', cursor: 'pointer',
            }}
          >
            {t === 'wine' ? 'Wine (CDV)' : 'Glass (DL)'}
          </button>
        ))}
      </div>

      {/* Filter Card */}
      <Card style={{ marginBottom: 16, padding: '12px 16px' }}>
        {filterLoading ? (
          <div style={{ textAlign: 'center', padding: 12, color: 'var(--color-text-lighter)', fontSize: 'var(--text-xs)' }}>필터 로딩 중...</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ minWidth: 90 }}>
              <div style={labelStyle}>담당자</div>
              <select style={selectStyle} value={manager} onChange={e => setManager(e.target.value)}>
                <option value="">전체</option>
                {filters?.managers.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ minWidth: 80 }}>
              <div style={labelStyle}>부서</div>
              <select style={selectStyle} value={department} onChange={e => setDepartment(e.target.value)}>
                <option value="">전체</option>
                {filters?.departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div style={{ minWidth: 90 }}>
              <div style={labelStyle}>업종</div>
              <select style={selectStyle} value={businessType} onChange={e => setBusinessType(e.target.value)}>
                <option value="">전체</option>
                {filters?.businessTypes.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div style={{ minWidth: 120 }}>
              <div style={labelStyle}>시작일</div>
              <input type="date" style={inputStyle} value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div style={{ minWidth: 120 }}>
              <div style={labelStyle}>종료일</div>
              <input type="date" style={inputStyle} value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div style={{ minWidth: 100, flex: 1 }}>
              <div style={labelStyle}>거래처</div>
              <input
                type="text" style={inputStyle} placeholder="검색"
                value={clientSearch} onChange={e => setClientSearch(e.target.value)}
              />
            </div>
            <button
              onClick={resetFilters}
              style={{
                height: 34, padding: '0 12px', fontSize: 'var(--text-xs)',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                background: 'var(--color-background)', cursor: 'pointer', color: 'var(--color-text-light)',
                whiteSpace: 'nowrap',
              }}
            >
              초기화
            </button>
          </div>
        )}
      </Card>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-lighter)', fontSize: 'var(--text-sm)' }}>데이터 로딩 중...</div>
      ) : !data ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-lighter)' }}>데이터가 없습니다. 출고현황 엑셀을 먼저 업로드하세요.</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <Card>
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)', marginBottom: 4 }}>총 매출</div>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: '#8B1538' }}>
                  {formatKrw(data.summary.totalRevenue)}
                </div>
              </div>
            </Card>
            <Card>
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)', marginBottom: 4 }}>출고 건수</div>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-text)' }}>
                  {data.summary.totalCount.toLocaleString()}
                </div>
              </div>
            </Card>
            <Card>
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)', marginBottom: 4 }}>총 수량</div>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-text)' }}>
                  {data.summary.totalQuantity.toLocaleString()}
                </div>
              </div>
            </Card>
          </div>

          {/* Manager Analysis + Business Analysis (side by side on desktop) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, marginBottom: 24 }}>
            {/* Manager Analysis */}
            {data.managerAnalysis.length > 0 && (
              <Card>
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 16 }}>담당자별 분석</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                      {['담당자', '거래처', '업종별', '할인율', '매출'].map(h => (
                        <th key={h} style={{
                          padding: '8px 10px',
                          textAlign: h === '담당자' || h === '업종별' ? 'left' : 'right',
                          fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--color-text-light)',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.managerAnalysis.map(m => (
                      <tr key={m.manager} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 500 }}>{m.manager}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{m.clientCount}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {m.bizClients.map(bc => (
                              <span key={bc.biz} style={{
                                fontSize: 'var(--text-xs)', padding: '2px 6px',
                                background: 'var(--color-background)', borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--color-border)', whiteSpace: 'nowrap',
                              }}>
                                {bc.biz} <b>{bc.count}</b>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{
                          padding: '8px 10px', textAlign: 'right', fontWeight: 600,
                          color: m.discountRate != null
                            ? m.discountRate > 15 ? '#E53E3E' : m.discountRate > 5 ? '#DD6B20' : '#38A169'
                            : 'var(--color-text-lighter)',
                        }}>
                          {m.discountRate != null ? `${m.discountRate}%` : '-'}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{formatKrw(m.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}

            {/* Business Type / Brand Analysis */}
            {(data.businessAnalysis.length > 0 || data.brandAnalysis.length > 0) && (
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>
                    {bizView === 'business' ? '업종별 매출' : '브랜드별 매출'}
                  </h3>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['business', 'brand'] as const).map(v => (
                      <button
                        key={v}
                        onClick={() => setBizView(v)}
                        style={{
                          padding: '4px 12px', fontSize: 'var(--text-xs)', fontWeight: bizView === v ? 700 : 400,
                          border: bizView === v ? '1px solid #8B1538' : '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                          background: bizView === v ? 'rgba(139,21,56,0.08)' : 'var(--color-background)',
                          color: bizView === v ? '#8B1538' : 'var(--color-text-light)',
                        }}
                      >
                        {v === 'business' ? '업종' : '브랜드'}
                      </button>
                    ))}
                  </div>
                </div>
                {(() => {
                  const chartData = bizView === 'business'
                    ? data.businessAnalysis.slice(0, 10)
                    : data.brandAnalysis.slice(0, 10);
                  const totalRev = data.summary.totalRevenue;
                  return (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ width: 200, height: 200, flexShrink: 0 }}>
                        <BizPieChart data={chartData} colors={PIE_COLORS} />
                      </div>
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
                          <tbody>
                            {chartData.map((b, i) => {
                              const pct = totalRev > 0 ? ((b.revenue / totalRev) * 100).toFixed(1) : '0';
                              return (
                                <tr key={b.name} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                  <td style={{ padding: '4px 8px' }}>
                                    <span style={{
                                      display: 'inline-block', width: 10, height: 10, borderRadius: 2,
                                      background: PIE_COLORS[i % PIE_COLORS.length], marginRight: 6,
                                    }} />
                                    {b.name}
                                  </td>
                                  <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }}>{formatKrw(b.revenue)}</td>
                                  <td style={{ padding: '4px 8px', textAlign: 'right', color: 'var(--color-text-light)' }}>{pct}%</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </Card>
            )}
          </div>

          {/* Sales Trend Chart */}
          {data.dailyTrend.length > 0 && (
            <Card style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>매출 추이</h3>
                <div style={{ display: 'flex', gap: 4 }}>
                  {([['daily', '일간'], ['weekly', '주간'], ['monthly', '월간']] as const).map(([v, label]) => (
                    <button
                      key={v}
                      onClick={() => setTrendPeriod(v)}
                      style={{
                        padding: '4px 12px', fontSize: 'var(--text-xs)', fontWeight: trendPeriod === v ? 700 : 400,
                        border: trendPeriod === v ? '1px solid #8B1538' : '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                        background: trendPeriod === v ? 'rgba(139,21,56,0.08)' : 'var(--color-background)',
                        color: trendPeriod === v ? '#8B1538' : 'var(--color-text-light)',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {(() => {
                let trendData = data.dailyTrend;

                if (trendPeriod === 'weekly') {
                  const weekMap = new Map<string, number>();
                  for (const d of data.dailyTrend) {
                    const dt = new Date(d.date);
                    const day = dt.getDay();
                    const mon = new Date(dt);
                    mon.setDate(dt.getDate() - (day === 0 ? 6 : day - 1));
                    const key = mon.toISOString().slice(0, 10);
                    weekMap.set(key, (weekMap.get(key) || 0) + d.revenue);
                  }
                  trendData = Array.from(weekMap.entries())
                    .map(([date, revenue]) => ({ date, revenue }))
                    .sort((a, b) => a.date.localeCompare(b.date));
                } else if (trendPeriod === 'monthly') {
                  const monthMap = new Map<string, number>();
                  for (const d of data.dailyTrend) {
                    const key = d.date.slice(0, 7);
                    monthMap.set(key, (monthMap.get(key) || 0) + d.revenue);
                  }
                  trendData = Array.from(monthMap.entries())
                    .map(([date, revenue]) => ({ date, revenue }))
                    .sort((a, b) => a.date.localeCompare(b.date));
                }

                const tickFmt = (d: string) => {
                  if (trendPeriod === 'monthly') return d.slice(2).replace('-', '/');
                  return formatDateShort(d);
                };
                const labelFmt = (d: string) => {
                  if (trendPeriod === 'weekly') return `${d} 주`;
                  if (trendPeriod === 'monthly') return `${d}`;
                  return d;
                };

                return (
                  <div style={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis dataKey="date" tickFormatter={tickFmt} tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v: number) => formatKrw(v)} tick={{ fontSize: 11 }} width={60} />
                        <Tooltip
                          formatter={(value: number) => [`${value.toLocaleString()}원`, '매출']}
                          labelFormatter={labelFmt}
                        />
                        <Line type="monotone" dataKey="revenue" stroke="#8B1538" strokeWidth={2} dot={trendData.length < 40} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}
            </Card>
          )}

          {/* Client Ranking Table */}
          {data.clientRanking.length > 0 && (
            <Card style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 16 }}>
                거래처별 매출 순위 <span style={{ fontWeight: 400, fontSize: 'var(--text-xs)', color: 'var(--color-text-light)' }}>상위 30</span>
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                      {['#', '변동', '코드', '거래처명', '매출', '할인율', '수량', '품목수'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: h === '거래처명' ? 'left' : h === '변동' ? 'center' : 'right', fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--color-text-light)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.clientRanking.map((c, i) => (
                      <tr
                        key={c.code}
                        onClick={() => openClientDetail(c.code, c.name)}
                        style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,21,56,0.04)')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}
                      >
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: i < 3 ? '#8B1538' : 'var(--color-text)' }}>{i + 1}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 'var(--text-xs)', fontWeight: 700 }}>
                          {c.isNew ? (
                            <span style={{
                              background: '#8B1538', color: '#fff',
                              padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                              fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
                            }}>NEW</span>
                          ) : c.rankChange != null && c.rankChange !== 0 ? (
                            <span style={{ color: c.rankChange > 0 ? '#E53E3E' : '#3182CE' }}>
                              {c.rankChange > 0 ? `▲${c.rankChange}` : `▼${Math.abs(c.rankChange)}`}
                            </span>
                          ) : c.rankChange === 0 ? (
                            <span style={{ color: 'var(--color-text-lighter)' }}>-</span>
                          ) : null}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--color-text-light)' }}>{c.code}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: '#8B1538' }}>{c.name}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>{formatKrw(c.revenue)}</td>
                        <td style={{
                          padding: '8px 12px', textAlign: 'right', fontWeight: 600,
                          color: c.discountRate != null
                            ? c.discountRate > 15 ? '#E53E3E' : c.discountRate > 5 ? '#DD6B20' : '#38A169'
                            : 'var(--color-text-lighter)',
                        }}>
                          {c.discountRate != null ? `${c.discountRate}%` : '-'}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{c.quantity.toLocaleString()}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{c.itemCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

        </>
      )}

      {/* Client Detail Bottom Sheet */}
      {selectedClient && (
        <div
          onClick={() => setSelectedClient(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--color-card, #fff)', borderRadius: '16px 16px 0 0',
              width: '100%', maxWidth: 700, maxHeight: '75vh',
              display: 'flex', flexDirection: 'column',
              animation: 'slideUp 0.25s ease-out',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid var(--color-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>{selectedClient.name}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)' }}>코드: {selectedClient.code}</div>
              </div>
              <button
                onClick={() => setSelectedClient(null)}
                style={{
                  width: 32, height: 32, borderRadius: '50%', border: 'none',
                  background: 'var(--color-background)', cursor: 'pointer',
                  fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                &times;
              </button>
            </div>

            {/* Content */}
            <div style={{ overflow: 'auto', flex: 1, padding: '0 20px 20px' }}>
              {clientDetailLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-lighter)', fontSize: 'var(--text-sm)' }}>로딩 중...</div>
              ) : clientItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-lighter)' }}>데이터가 없습니다.</div>
              ) : (
                <>
                  {(() => {
                    const totalRev = clientItems.reduce((s, i) => s + i.revenue, 0);
                    const matched = clientItems.filter(i => i.discountRate != null);
                    const avgDiscount = matched.length > 0
                      ? Math.round(matched.reduce((s, i) => s + (i.discountRate ?? 0) * i.revenue, 0) / matched.reduce((s, i) => s + i.revenue, 0) * 10) / 10
                      : null;
                    return (
                      <div style={{ display: 'flex', gap: 16, padding: '12px 0 8px', fontSize: 'var(--text-xs)', color: 'var(--color-text-light)', fontWeight: 600 }}>
                        <span>총 {clientItems.length}개 품목</span>
                        <span>매출 {formatKrw(totalRev)}원</span>
                        {avgDiscount != null && (
                          <span style={{
                            color: avgDiscount > 15 ? '#E53E3E' : avgDiscount > 5 ? '#DD6B20' : '#38A169',
                          }}>
                            평균 할인율 {avgDiscount}%
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                        {['#', '품번', '품명', '공급가', '판매가', '할인율', '수량', '매출'].map(h => (
                          <th key={h} style={{
                            padding: '8px 10px', fontWeight: 600, fontSize: 'var(--text-xs)',
                            color: 'var(--color-text-light)',
                            textAlign: h === '품명' ? 'left' : 'right',
                            position: 'sticky', top: 0, background: 'var(--color-card, #fff)',
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {clientItems.map((item, idx) => (
                        <tr key={item.item_no} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--color-text-light)', fontSize: 'var(--text-xs)' }}>{idx + 1}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--color-text-light)' }}>{item.item_no}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.item_name}>{item.item_name}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--color-text-light)' }}>
                            {item.supplyPrice != null ? item.supplyPrice.toLocaleString() : '-'}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--color-text-light)' }}>
                            {item.avgSellingPrice != null ? item.avgSellingPrice.toLocaleString() : '-'}
                          </td>
                          <td style={{
                            padding: '8px 10px', textAlign: 'right', fontWeight: 600,
                            color: item.discountRate != null
                              ? item.discountRate > 15 ? '#E53E3E' : item.discountRate > 5 ? '#DD6B20' : '#38A169'
                              : 'var(--color-text-lighter)',
                          }}>
                            {item.discountRate != null ? `${item.discountRate}%` : '-'}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>{item.quantity.toLocaleString()}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{formatKrw(item.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
