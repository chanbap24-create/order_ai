'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Card from '@/app/components/ui/Card';
import type { DashboardStats, InventoryChange } from '@/app/types/wine';

const LineChart = dynamic(() => import('recharts').then(m => m.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then(m => m.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import('recharts').then(m => m.Legend), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });

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

export default function DashboardTab() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((r) => r.json())
      .then((data) => { if (data.success) setStats(data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-light)' }}>로딩 중...</div>;
  if (!stats) return <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-error)' }}>데이터를 불러올 수 없습니다.</div>;

  const chartData = stats.inventoryHistory.map(h => ({
    date: h.recorded_date.slice(5),
    CDV: Math.round(h.cdv_value / 10000),
    DL: Math.round(h.dl_value / 10000),
  }));
  const showChart = chartData.length >= 2;

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

      {/* 재고금액 추이 차트 */}
      {showChart && (
        <Card style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>재고금액 추이</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `${v.toLocaleString()}만`} />
                <Tooltip formatter={(v: number) => [`${v.toLocaleString()}만원`, '']} labelFormatter={(l: string) => `날짜: ${l}`} />
                <Legend />
                <Line type="monotone" dataKey="CDV" stroke="#5A1515" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="DL" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
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
