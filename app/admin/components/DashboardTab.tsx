'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from 'recharts';
import Card from '@/app/components/ui/Card';
import type { DashboardStats, InventoryChange } from '@/app/types/wine';

function BizPieChart({ data: chartData, colors, label = '매출' }: { data: Array<{ name: string; revenue: number }>; colors: string[]; label?: string }) {
  if (!chartData || chartData.length === 0) return null;
  return (
    <PieChart width={170} height={170}>
      <Pie
        data={chartData}
        dataKey="revenue"
        nameKey="name"
        cx="50%" cy="50%"
        outerRadius={70}
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
      <Tooltip formatter={(value: number) => [`${value.toLocaleString()}원`, label]} />
    </PieChart>
  );
}

const PIE_COLORS = ['#8B1538', '#4D96FF', '#6BCB77', '#FF6B6B', '#FFD93D', '#9B59B6', '#FF8C42', '#00BCD4', '#34495E', '#E91E63'];

function formatKrw(v: number | null | undefined) {
  const n = v ?? 0;
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억`;
  if (n >= 1_0000) return `${Math.round(n / 1_0000).toLocaleString()}만`;
  return n.toLocaleString();
}

function formatChangeKrw(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1_0000_0000) return `${(abs / 1_0000_0000).toFixed(1)}억`;
  if (abs >= 1_0000) return `${Math.round(abs / 1_0000).toLocaleString()}만`;
  return abs.toLocaleString();
}

function ChangeIndicator({ change }: { change: InventoryChange | null }) {
  if (!change || change.amount === 0) return null;
  const isUp = change.amount > 0;
  const arrow = isUp ? '▲' : '▼';
  const color = isUp ? '#E53E3E' : '#3182CE';

  return (
    <div style={{ marginTop: 6, fontSize: 'var(--text-sm)', color, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      <span>{arrow} {formatChangeKrw(change.amount)}원</span>
      <span style={{ fontSize: 'var(--text-xs)', opacity: 0.8 }}>({isUp ? '+' : ''}{change.rate.toFixed(1)}%)</span>
    </div>
  );
}

interface AnalysisData {
  summary: { totalRevenue: number; totalQuantity: number; totalCount: number };
  brandAnalysis: Array<{ name: string; revenue: number }>;
  countryAnalysis?: Array<{ name: string; revenue: number }>;
  dailyTrend: Array<{ date: string; revenue: number }>;
}

type SourceMode = 'all' | 'cdv' | 'dl';
const SOURCE_LABELS: Record<SourceMode, string> = { all: '전체', cdv: 'CDV', dl: 'DL' };
const SOURCE_COLORS: Record<SourceMode, string> = { all: '#8B1538', cdv: '#5A1515', dl: '#2563eb' };

/** {name,revenue} 배열 합산 병합 */
function mergeRevArrays(a: Array<{ name: string; revenue: number }>, b: Array<{ name: string; revenue: number }>) {
  const m = new Map<string, number>();
  for (const x of a) m.set(x.name, (m.get(x.name) || 0) + x.revenue);
  for (const x of b) m.set(x.name, (m.get(x.name) || 0) + x.revenue);
  return Array.from(m.entries()).map(([name, revenue]) => ({ name, revenue })).sort((a2, b2) => b2.revenue - a2.revenue);
}

/** {name,value} 배열 합산 병합 */
function mergeValArrays(a: Array<{ name: string; value: number }>, b: Array<{ name: string; value: number }>) {
  const m = new Map<string, number>();
  for (const x of a) m.set(x.name, (m.get(x.name) || 0) + x.value);
  for (const x of b) m.set(x.name, (m.get(x.name) || 0) + x.value);
  return Array.from(m.entries()).map(([name, value]) => ({ name, value })).sort((a2, b2) => b2.value - a2.value);
}

export default function DashboardTab() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [glassAnalysis, setGlassAnalysis] = useState<AnalysisData | null>(null);
  const [source, setSource] = useState<SourceMode>('all');
  const [invPeriod, setInvPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const year = new Date().getFullYear();
    const startDate = `${year}-01-01`;
    const endDate = new Date().toISOString().slice(0, 10);

    Promise.all([
      fetch('/api/admin/dashboard').then(r => r.json()),
      fetch(`/api/admin/client-analysis?type=wine&startDate=${startDate}&endDate=${endDate}`).then(r => r.json()),
      fetch(`/api/admin/client-analysis?type=glass&startDate=${startDate}&endDate=${endDate}`).then(r => r.json()),
    ])
      .then(([dashRes, wineRes, glassRes]) => {
        if (dashRes.success) setStats(dashRes.data);
        if (wineRes.success) setAnalysis(wineRes);
        if (glassRes.success) setGlassAnalysis(glassRes);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !mounted) return <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-light)' }}>로딩 중...</div>;
  if (!stats) return <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-error)' }}>데이터를 불러올 수 없습니다.</div>;

  // Derived values
  const totalInventory = (stats.cdvInventoryValue || 0) + (stats.dlInventoryValue || 0);
  const totalRevenue = analysis?.summary.totalRevenue ?? 0;

  // Inventory history
  const rawInv = stats.inventoryHistory;

  // 재고 변동 추이 (연속 기록 간 변동량, 만원 단위)
  const invChangeData: Array<{ date: string; cdv: number; dl: number }> = [];
  if (rawInv.length >= 2) {
    for (let i = 1; i < rawInv.length; i++) {
      const prev = rawInv[i - 1];
      const curr = rawInv[i];
      invChangeData.push({
        date: curr.recorded_date.slice(5), // MM-DD
        cdv: Math.round((curr.cdv_value - prev.cdv_value) / 1_0000),
        dl: Math.round((curr.dl_value - prev.dl_value) / 1_0000),
      });
    }
  }

  // 일봉/주봉/월봉 (스냅샷: 기간 내 마지막 값)
  const inventoryLineData: Array<{ date: string; cdv: number; dl: number }> = [];
  if (rawInv.length > 0) {
    if (invPeriod === 'daily') {
      for (const h of rawInv) {
        inventoryLineData.push({ date: h.recorded_date.slice(5), cdv: Math.round(h.cdv_value / 1_0000), dl: Math.round(h.dl_value / 1_0000) });
      }
    } else {
      const grouped = new Map<string, { cdv: number; dl: number }>();
      for (const h of rawInv) {
        let key: string;
        if (invPeriod === 'weekly') {
          const dt = new Date(h.recorded_date);
          const day = dt.getDay();
          const mon = new Date(dt);
          mon.setDate(dt.getDate() - ((day + 6) % 7));
          key = mon.toISOString().slice(0, 10);
        } else {
          key = h.recorded_date.slice(0, 7);
        }
        grouped.set(key, { cdv: Math.round(h.cdv_value / 1_0000), dl: Math.round(h.dl_value / 1_0000) });
      }
      for (const [k, v] of Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
        const label = invPeriod === 'weekly' ? k.slice(5) : k.slice(2).replace('-', '/');
        inventoryLineData.push({ date: label, ...v });
      }
    }
  }

  return (
    <div>
      {/* Section 1: KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        <Card size="sm" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-lighter)', marginBottom: 4, fontWeight: 600 }}>총 매출</div>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: '#8B1538' }}>{analysis ? formatKrw(totalRevenue) : '-'}</div>
          {analysis && <div style={{ fontSize: 10, color: 'var(--color-text-lighter)', marginTop: 2 }}>{new Date().getFullYear()}년 누적</div>}
        </Card>
        <Card size="sm" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-lighter)', marginBottom: 4, fontWeight: 600 }}>총 재고금액</div>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-text)' }}>{formatKrw(totalInventory)}</div>
          <div style={{ fontSize: 10, color: 'var(--color-text-lighter)', marginTop: 2 }}>CDV + DL</div>
        </Card>
      </div>

      {/* Section 2: Inventory Cards (compact) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        <Card size="sm" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-lighter)', marginBottom: 2, fontWeight: 600, letterSpacing: '0.05em' }}>CDV (까브드뱅)</div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: '#5A1515' }}>{formatKrw(stats.cdvInventoryValue)}원</div>
          <ChangeIndicator change={stats.cdvChange} />
        </Card>
        <Card size="sm" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-lighter)', marginBottom: 2, fontWeight: 600, letterSpacing: '0.05em' }}>DL (대유라이프)</div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: '#2563eb' }}>{formatKrw(stats.dlInventoryValue)}원</div>
          <ChangeIndicator change={stats.dlChange} />
        </Card>
      </div>

      {/* Section 3: Charts (2 columns) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
        {/* 재고 변동 BarChart */}
        {invChangeData.length > 0 && (
          <Card>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>재고 변동 추이</h3>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={invChangeData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={invChangeData.length > 15 ? Math.floor(invChangeData.length / 12) : 0} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v.toLocaleString()}만`} width={65} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value > 0 ? '+' : ''}${value.toLocaleString()}만원`,
                      name === 'cdv' ? 'CDV' : 'DL',
                    ]}
                  />
                  <Legend formatter={(value: string) => value === 'cdv' ? 'CDV' : 'DL'} />
                  <Bar dataKey="cdv" fill="#5A1515" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="dl" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Inventory History LineChart */}
        {inventoryLineData.length > 1 && (
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, margin: 0 }}>재고금액 추이</h3>
              <div style={{ display: 'inline-flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                {([['daily', '일봉'], ['weekly', '주봉'], ['monthly', '월봉']] as const).map(([k, lbl]) => (
                  <button
                    key={k}
                    onClick={() => setInvPeriod(k)}
                    style={{
                      padding: '3px 10px', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
                      background: invPeriod === k ? '#34495E' : 'transparent',
                      color: invPeriod === k ? '#fff' : 'var(--color-text-light)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={inventoryLineData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={invPeriod === 'daily' && inventoryLineData.length > 15 ? Math.floor(inventoryLineData.length / 12) : 0} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v.toLocaleString()}만`} width={60} />
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value.toLocaleString()}만원`, name === 'cdv' ? 'CDV' : 'DL']}
                  />
                  <Legend formatter={(value: string) => value === 'cdv' ? 'CDV' : 'DL'} />
                  <Line type="monotone" dataKey="cdv" stroke="#5A1515" strokeWidth={2} dot={inventoryLineData.length < 20} />
                  <Line type="monotone" dataKey="dl" stroke="#2563eb" strokeWidth={2} dot={inventoryLineData.length < 20} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>

      {/* ── 소스 토글 (전체 / CDV / DL) ── */}
      {(analysis || glassAnalysis || stats.inventoryByCountryCdv?.length || stats.inventoryByCountryDl?.length) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-4)' }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-light)' }}>분석 소스</span>
          <div style={{ display: 'inline-flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
            {(['all', 'cdv', 'dl'] as SourceMode[]).map(s => (
              <button
                key={s}
                onClick={() => setSource(s)}
                style={{
                  padding: '5px 14px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                  background: source === s ? SOURCE_COLORS[s] : 'transparent',
                  color: source === s ? '#fff' : 'var(--color-text-light)',
                  transition: 'all 0.15s',
                }}
              >
                {SOURCE_LABELS[s]}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 10, color: 'var(--color-text-lighter)' }}>
            {source === 'all' ? '까브드뱅 + 대유라이프' : source === 'cdv' ? '까브드뱅 (와인)' : '대유라이프 (글라스)'}
          </span>
        </div>
      )}

      {/* Section 4: 매출 분석 (2열) */}
      {(() => {
        const wBrand = analysis?.brandAnalysis || [];
        const gBrand = glassAnalysis?.brandAnalysis || [];
        const wCountry = analysis?.countryAnalysis || [];
        const gCountry = glassAnalysis?.countryAnalysis || [];
        const brandData = source === 'cdv' ? wBrand : source === 'dl' ? gBrand : mergeRevArrays(wBrand, gBrand);
        const countryData = source === 'cdv' ? wCountry : source === 'dl' ? gCountry : mergeRevArrays(wCountry, gCountry);
        const salesTotalRev = source === 'cdv' ? (analysis?.summary.totalRevenue ?? 0)
          : source === 'dl' ? (glassAnalysis?.summary.totalRevenue ?? 0)
          : (analysis?.summary.totalRevenue ?? 0) + (glassAnalysis?.summary.totalRevenue ?? 0);

        if (brandData.length === 0 && countryData.length === 0) return null;
        return (
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>매출 분석</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'var(--space-4)' }}>
              {countryData.length > 0 && (
                <Card>
                  <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-2)', color: 'var(--color-text-light)' }}>국가별 매출</h4>
                  {(() => {
                    const chartData = countryData.slice(0, 10);
                    return (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ width: 170, height: 170, flexShrink: 0 }}>
                          <BizPieChart data={chartData} colors={PIE_COLORS} label="매출" />
                        </div>
                        <div style={{ flex: 1, minWidth: 100 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
                            <tbody>
                              {chartData.map((b, i) => (
                                <tr key={b.name} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                  <td style={{ padding: '3px 6px' }}>
                                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], marginRight: 4 }} />
                                    {b.name}
                                  </td>
                                  <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 600 }}>{formatKrw(b.revenue)}</td>
                                  <td style={{ padding: '3px 6px', textAlign: 'right', color: 'var(--color-text-light)' }}>{salesTotalRev > 0 ? ((b.revenue / salesTotalRev) * 100).toFixed(1) : '0'}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}
                </Card>
              )}
              {brandData.length > 0 && (
                <Card>
                  <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-2)', color: 'var(--color-text-light)' }}>브랜드별 매출</h4>
                  {(() => {
                    const chartData = brandData.slice(0, 10);
                    return (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ width: 170, height: 170, flexShrink: 0 }}>
                          <BizPieChart data={chartData} colors={PIE_COLORS} label="매출" />
                        </div>
                        <div style={{ flex: 1, minWidth: 100 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
                            <tbody>
                              {chartData.map((b, i) => (
                                <tr key={b.name} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                  <td style={{ padding: '3px 6px' }}>
                                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], marginRight: 4 }} />
                                    {b.name}
                                  </td>
                                  <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 600 }}>{formatKrw(b.revenue)}</td>
                                  <td style={{ padding: '3px 6px', textAlign: 'right', color: 'var(--color-text-light)' }}>{salesTotalRev > 0 ? ((b.revenue / salesTotalRev) * 100).toFixed(1) : '0'}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}
                </Card>
              )}
            </div>
          </div>
        );
      })()}

      {/* Section 5: 재고 분석 (2열) */}
      {(() => {
        const cCdv = stats.inventoryByCountryCdv || [];
        const cDl = stats.inventoryByCountryDl || [];
        const bCdv = stats.inventoryByBrandCdv || [];
        const bDl = stats.inventoryByBrandDl || [];
        const countryInv = source === 'cdv' ? cCdv : source === 'dl' ? cDl : mergeValArrays(cCdv, cDl);
        const brandInv = source === 'cdv' ? bCdv : source === 'dl' ? bDl : mergeValArrays(bCdv, bDl);

        if (countryInv.length === 0 && brandInv.length === 0) return null;
        return (
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>재고 분석</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'var(--space-4)' }}>
              {countryInv.length > 0 && (
                <Card>
                  <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-2)', color: 'var(--color-text-light)' }}>국가별 재고</h4>
                  {(() => {
                    const chartData = countryInv.slice(0, 10).map(x => ({ name: x.name, revenue: x.value }));
                    const total = countryInv.reduce((s, x) => s + x.value, 0);
                    return (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ width: 170, height: 170, flexShrink: 0 }}>
                          <BizPieChart data={chartData} colors={PIE_COLORS} label="재고가액" />
                        </div>
                        <div style={{ flex: 1, minWidth: 100 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
                            <tbody>
                              {chartData.map((b, i) => (
                                <tr key={b.name} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                  <td style={{ padding: '3px 6px' }}>
                                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], marginRight: 4 }} />
                                    {b.name}
                                  </td>
                                  <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 600 }}>{formatKrw(b.revenue)}</td>
                                  <td style={{ padding: '3px 6px', textAlign: 'right', color: 'var(--color-text-light)' }}>{total > 0 ? ((b.revenue / total) * 100).toFixed(1) : '0'}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}
                </Card>
              )}
              {brandInv.length > 0 && (
                <Card>
                  <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-2)', color: 'var(--color-text-light)' }}>브랜드별 재고</h4>
                  {(() => {
                    const chartData = brandInv.slice(0, 10).map(x => ({ name: x.name, revenue: x.value }));
                    const total = brandInv.reduce((s, x) => s + x.value, 0);
                    return (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ width: 170, height: 170, flexShrink: 0 }}>
                          <BizPieChart data={chartData} colors={PIE_COLORS} label="재고가액" />
                        </div>
                        <div style={{ flex: 1, minWidth: 100 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
                            <tbody>
                              {chartData.map((b, i) => (
                                <tr key={b.name} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                  <td style={{ padding: '3px 6px' }}>
                                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], marginRight: 4 }} />
                                    {b.name}
                                  </td>
                                  <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 600 }}>{formatKrw(b.revenue)}</td>
                                  <td style={{ padding: '3px 6px', textAlign: 'right', color: 'var(--color-text-light)' }}>{total > 0 ? ((b.revenue / total) * 100).toFixed(1) : '0'}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}
                </Card>
              )}
            </div>
          </div>
        );
      })()}

      {/* Section 6: 품목별 재고 테이블 */}
      {(() => {
        const showCdv = source !== 'dl' && (stats.inventoryByItemCdv?.length ?? 0) > 0;
        const showDl = source !== 'cdv' && (stats.inventoryByItemDl?.length ?? 0) > 0;
        if (!showCdv && !showDl) return null;

        const renderTable = (items: NonNullable<DashboardStats['inventoryByItemCdv']>, label: string, color: string) => {
          // 회전률 기준: 90일 출고가 재고의 10% 미만이면서 재고가액이 상위 30%
          const valueThreshold = items.length >= 3 ? items[Math.floor(items.length * 0.3) - 1]?.value ?? 0 : 0;
          const isSlowMover = (it: typeof items[0]) => {
            const qty = it.qty || 0;
            const s90 = it.ship90 || 0;
            // 90일 출고가 재고의 10% 미만 & 재고가액이 상위 30%
            return qty > 0 && s90 < qty * 0.1 && it.value >= valueThreshold;
          };

          return (
            <Card>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
                <span style={{ color }}>{label}</span> 품목별 재고 Top {items.length}
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border)', background: 'var(--color-bg-light, #fafafa)' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, width: 30 }}>#</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>품번</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>품명</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>재고</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>30일</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>90일</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>재고가액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => {
                      const slow = isSlowMover(it);
                      const rowColor = slow ? '#E53E3E' : undefined;
                      return (
                        <tr key={it.itemNo} style={{ borderBottom: '1px solid var(--color-border)', color: rowColor, fontWeight: slow ? 600 : undefined }}>
                          <td style={{ padding: '5px 8px', textAlign: 'center', color: slow ? '#E53E3E' : 'var(--color-text-lighter)' }}>{i + 1}</td>
                          <td style={{ padding: '5px 8px', fontFamily: 'monospace', fontSize: 11 }}>{it.itemNo}</td>
                          <td style={{ padding: '5px 8px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right' }}>{it.qty ?? 0}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right' }}>{it.ship30 ?? 0}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right' }}>{it.ship90 ?? 0}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>{formatKrw(it.value)}원</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        };

        return (
          <div style={{ display: 'grid', gridTemplateColumns: showCdv && showDl ? 'repeat(auto-fit, minmax(400px, 1fr))' : '1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
            {showCdv && renderTable(stats.inventoryByItemCdv!, 'CDV', '#5A1515')}
            {showDl && renderTable(stats.inventoryByItemDl!, 'DL', '#2563eb')}
          </div>
        );
      })()}
    </div>
  );
}

