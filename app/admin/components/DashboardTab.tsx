'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Card from '@/app/components/ui/Card';
import type { DashboardStats, InventoryChange } from '@/app/types/wine';

const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false });
const Cell = dynamic(() => import('recharts').then(m => m.Cell), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import('recharts').then(m => m.Legend), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
const ReferenceLine = dynamic(() => import('recharts').then(m => m.ReferenceLine), { ssr: false });

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

function formatDateShort(dateStr: string) {
  const parts = dateStr.split('-');
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

function InlineChange({ cur, prev }: { cur: number; prev: number }) {
  if (!prev || prev === 0) return null;
  const diff = cur - prev;
  if (diff === 0) return <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-lighter)', marginLeft: 4 }}>-</span>;
  const isUp = diff > 0;
  const color = isUp ? '#E53E3E' : '#3182CE';
  const arrow = isUp ? '▲' : '▼';
  const rate = ((diff / prev) * 100).toFixed(1);
  return (
    <span style={{ fontSize: 'var(--text-xs)', color, fontWeight: 600, marginLeft: 4 }}>
      {arrow}{formatChangeKrw(diff)} ({isUp ? '+' : ''}{rate}%)
    </span>
  );
}

type ChartPeriod = 'daily' | 'weekly' | 'monthly';

interface CandleItem {
  date: string;
  cdvRange: [number, number];
  dlRange: [number, number];
  cdvUp: boolean;
  dlUp: boolean;
  cdvVal: number;
  dlVal: number;
  cdvDiff: number;
  dlDiff: number;
}

/** ISO 주차 번호 (월~일 기준) */
function getWeekKey(dateStr: string) {
  const d = new Date(dateStr);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - jan1.getTime()) / 86400000);
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getMonthKey(dateStr: string) {
  return dateStr.slice(0, 7); // "YYYY-MM"
}

function aggregateHistory(
  hist: Array<{ recorded_date: string; cdv_value: number; dl_value: number }>,
  period: ChartPeriod
): CandleItem[] {
  if (period === 'daily') {
    return hist.map((h, i) => {
      const prev = i > 0 ? hist[i - 1] : null;
      const cdvVal = Math.round(h.cdv_value / 1_0000);
      const dlVal = Math.round(h.dl_value / 1_0000);
      const cdvPrev = prev ? Math.round(prev.cdv_value / 1_0000) : cdvVal;
      const dlPrev = prev ? Math.round(prev.dl_value / 1_0000) : dlVal;
      return {
        date: h.recorded_date.slice(5),
        cdvRange: [cdvPrev, cdvVal], dlRange: [dlPrev, dlVal],
        cdvUp: cdvVal >= cdvPrev, dlUp: dlVal >= dlPrev,
        cdvVal, dlVal, cdvDiff: cdvVal - cdvPrev, dlDiff: dlVal - dlPrev,
      };
    });
  }

  // 주봉/월봉: 기간별로 그룹핑 → 시가(첫날 전일종가), 종가(마지막날)
  const keyFn = period === 'weekly' ? getWeekKey : getMonthKey;
  const groups = new Map<string, typeof hist>();
  for (const h of hist) {
    const key = keyFn(h.recorded_date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(h);
  }

  const keys = [...groups.keys()];
  const result: CandleItem[] = [];

  for (let gi = 0; gi < keys.length; gi++) {
    const items = groups.get(keys[gi])!;
    const last = items[items.length - 1];
    const cdvVal = Math.round(last.cdv_value / 1_0000);
    const dlVal = Math.round(last.dl_value / 1_0000);

    // 시가 = 이전 그룹 마지막 값 (없으면 현재 그룹 첫 값)
    let cdvOpen = cdvVal;
    let dlOpen = dlVal;
    if (gi > 0) {
      const prevItems = groups.get(keys[gi - 1])!;
      const prevLast = prevItems[prevItems.length - 1];
      cdvOpen = Math.round(prevLast.cdv_value / 1_0000);
      dlOpen = Math.round(prevLast.dl_value / 1_0000);
    } else {
      cdvOpen = Math.round(items[0].cdv_value / 1_0000);
      dlOpen = Math.round(items[0].dl_value / 1_0000);
    }

    const label = period === 'weekly'
      ? keys[gi].replace(/^\d{4}-W/, '') + '주'
      : last.recorded_date.slice(5, 7) + '월';

    result.push({
      date: label,
      cdvRange: [cdvOpen, cdvVal], dlRange: [dlOpen, dlVal],
      cdvUp: cdvVal >= cdvOpen, dlUp: dlVal >= dlOpen,
      cdvVal, dlVal, cdvDiff: cdvVal - cdvOpen, dlDiff: dlVal - dlOpen,
    });
  }

  return result;
}

export default function DashboardTab() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('daily');

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((r) => r.json())
      .then((data) => { if (data.success) setStats(data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-light)' }}>로딩 중...</div>;
  if (!stats) return <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-error)' }}>데이터를 불러올 수 없습니다.</div>;

  const candleData = aggregateHistory(stats.inventoryHistory, chartPeriod);
  const showChart = candleData.length >= 1;

  // 최근 활동: 이력을 최신순으로, 이전 레코드 대비 변동 표시
  const historyDesc = [...stats.inventoryHistory].reverse();

  return (
    <div>
      {/* CDV / DL 재고금액 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <Card size="sm" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-lighter)', marginBottom: 4, fontWeight: 600, letterSpacing: '0.05em' }}>까브드뱅 (CDV)</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)', marginBottom: 4 }}>보세 + 용마로지스</div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: '#5A1515' }}>{formatKrw(stats.cdvInventoryValue)}원</div>
          <ChangeIndicator change={stats.cdvChange} />
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-lighter)', marginTop: 4 }}>총 재고금액 (공급가 기준)</div>
        </Card>
        <Card size="sm" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-lighter)', marginBottom: 4, fontWeight: 600, letterSpacing: '0.05em' }}>대유라이프 (DL)</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)', marginBottom: 4 }}>안성+GIG+GIG마케팅+GIG영업1</div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: '#2563eb' }}>{formatKrw(stats.dlInventoryValue)}원</div>
          <ChangeIndicator change={stats.dlChange} />
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-lighter)', marginTop: 4 }}>총 재고금액 (공급가 기준)</div>
        </Card>
      </div>

      {/* 재고금액 차트 */}
      {showChart && (
        <Card style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0 }}>재고금액 추이</h3>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-lighter)', marginTop: 2 }}>
                <span style={{ color: '#E53E3E' }}>■</span> 상승 &nbsp;
                <span style={{ color: '#3182CE' }}>■</span> 하락
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {([['daily', '일봉'], ['weekly', '주봉'], ['monthly', '월봉']] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setChartPeriod(key)}
                  style={{
                    padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 4, border: 'none', cursor: 'pointer',
                    background: chartPeriod === key ? '#5A1515' : '#f0f0f0',
                    color: chartPeriod === key ? '#fff' : '#666',
                    transition: 'all 0.15s',
                  }}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* CDV 일봉 */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: '#5A1515', marginBottom: 4 }}>CDV (까브드뱅)</div>
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={candleData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => `${v.toLocaleString()}만`}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    content={({ active, payload, label }: { active?: boolean; payload?: Array<{ payload: typeof candleData[0] }>; label?: string }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload;
                      return (
                        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
                          <div style={{ color: '#5A1515' }}>CDV: {d.cdvVal.toLocaleString()}만원</div>
                          <div style={{ color: d.cdvDiff >= 0 ? '#E53E3E' : '#3182CE', fontWeight: 600 }}>
                            {d.cdvDiff >= 0 ? '▲' : '▼'} {formatChangeKrw(d.cdvDiff * 10000)}원
                          </div>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine y={candleData[0]?.cdvRange[0]} stroke="#ccc" strokeDasharray="3 3" />
                  <Bar dataKey="cdvRange" barSize={candleData.length > 20 ? 8 : candleData.length > 10 ? 14 : 24} radius={[2, 2, 0, 0]}>
                    {candleData.map((d, i) => (
                      <Cell key={i} fill={d.cdvUp ? '#E53E3E' : '#3182CE'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* DL 일봉 */}
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: '#2563eb', marginBottom: 4 }}>DL (대유라이프)</div>
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={candleData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => `${v.toLocaleString()}만`}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    content={({ active, payload, label }: { active?: boolean; payload?: Array<{ payload: typeof candleData[0] }>; label?: string }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload;
                      return (
                        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
                          <div style={{ color: '#2563eb' }}>DL: {d.dlVal.toLocaleString()}만원</div>
                          <div style={{ color: d.dlDiff >= 0 ? '#E53E3E' : '#3182CE', fontWeight: 600 }}>
                            {d.dlDiff >= 0 ? '▲' : '▼'} {formatChangeKrw(d.dlDiff * 10000)}원
                          </div>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine y={candleData[0]?.dlRange[0]} stroke="#ccc" strokeDasharray="3 3" />
                  <Bar dataKey="dlRange" barSize={candleData.length > 20 ? 8 : candleData.length > 10 ? 14 : 24} radius={[2, 2, 0, 0]}>
                    {candleData.map((d, i) => (
                      <Cell key={i} fill={d.dlUp ? '#E53E3E' : '#3182CE'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      )}

      {/* 최근 재고 변동 이력 */}
      <Card>
        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>최근 재고 변동</h3>
        {historyDesc.length === 0 ? (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-lighter)' }}>재고 이력이 없습니다. 와인/글라스 재고현황을 업로드하면 기록됩니다.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-light)' }}>날짜</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#5A1515' }}>CDV</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#2563eb' }}>DL</th>
                </tr>
              </thead>
              <tbody>
                {historyDesc.map((h, idx) => {
                  const prev = historyDesc[idx + 1] || null;
                  return (
                    <tr key={h.recorded_date} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '8px 12px', color: 'var(--color-text-light)', whiteSpace: 'nowrap' }}>{formatDateShort(h.recorded_date)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 600 }}>{formatKrw(h.cdv_value)}원</span>
                        {prev && <InlineChange cur={h.cdv_value} prev={prev.cdv_value} />}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 600 }}>{formatKrw(h.dl_value)}원</span>
                        {prev && <InlineChange cur={h.dl_value} prev={prev.dl_value} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
