'use client';

import dynamic from 'next/dynamic';
import Card from '@/app/components/ui/Card';
import type { InvPeriod } from '../types';

const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false });
const LineChart = dynamic(() => import('recharts').then(m => m.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then(m => m.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import('recharts').then(m => m.Legend), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });

type Props = {
  invChangeData: Array<{ date: string; cdv: number; dl: number }>;
  inventoryLineData: Array<{ date: string; cdv: number; dl: number }>;
  invPeriod: InvPeriod;
  onPeriodChange: (p: InvPeriod) => void;
};

export function InventoryCharts({ invChangeData, inventoryLineData, invPeriod, onPeriodChange }: Props) {
  if (invChangeData.length === 0 && inventoryLineData.length <= 1) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      {invChangeData.length > 0 && (
        <Card>
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>재고 변동 추이</h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={invChangeData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ece4" vertical={false} />
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

      {inventoryLineData.length > 1 && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, margin: 0 }}>재고금액 추이</h3>
            <div style={{ display: 'inline-flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
              {([['daily', '일봉'], ['weekly', '주봉'], ['monthly', '월봉']] as const).map(([k, lbl]) => (
                <button
                  key={k}
                  onClick={() => onPeriodChange(k)}
                  style={{
                    padding: '3px 10px', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: invPeriod === k ? '#2c1810' : 'transparent',
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
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ece4" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={invPeriod === 'daily' && inventoryLineData.length > 15 ? Math.floor(inventoryLineData.length / 12) : 0} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `${v.toLocaleString()}만`}
                  width={60}
                  domain={[
                    (dataMin: number) => Math.floor(dataMin * 0.95),
                    (dataMax: number) => Math.ceil(dataMax * 1.02),
                  ]}
                />
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
  );
}
