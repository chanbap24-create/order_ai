'use client';

import { useEffect, useState } from 'react';
import Card from '@/app/components/ui/Card';
import { formatKrw } from '../lib/format';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from '../lib/recharts';

type Row = { sido: string; gu: string; sales: number; clients: number };
type Props = { type: 'wine' | 'glass'; startDate: string; endDate: string };

const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 };

export function RegionSalesCard({ type, startDate, endDate }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!startDate || !endDate) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/client-analysis/region?type=${type}&startDate=${startDate}&endDate=${endDate}`);
        const j = await res.json();
        if (!alive) return;
        setRows(Array.isArray(j.rows)
          ? j.rows.map((x: Row) => ({ sido: x.sido, gu: x.gu, sales: Number(x.sales) || 0, clients: Number(x.clients) || 0 }))
          : []);
      } catch {
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [type, startDate, endDate]);

  // 시도 집계 + 구 랭킹
  const sidoMap = new Map<string, number>();
  const guMap = new Map<string, { sido: string; gu: string; sales: number; clients: number }>();
  for (const r of rows) {
    sidoMap.set(r.sido, (sidoMap.get(r.sido) || 0) + r.sales);
    const k = `${r.sido}|${r.gu}`;
    const g = guMap.get(k) || { sido: r.sido, gu: r.gu, sales: 0, clients: 0 };
    g.sales += r.sales; g.clients += r.clients; guMap.set(k, g);
  }
  const sidoData = [...sidoMap.entries()].map(([name, sales]) => ({ name, sales })).sort((a, b) => b.sales - a.sales).slice(0, 12);
  const total = [...sidoMap.values()].reduce((s, v) => s + v, 0);
  const guData = [...guMap.values()].filter((g) => g.gu !== '(구외)').sort((a, b) => b.sales - a.sales).slice(0, 15);
  const guMax = guData[0]?.sales || 1;

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '0.01em' }}>
          지역별 매출
        </h3>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>거래처 주소 기준 · 총 {formatKrw(total)}</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: 13 }}>로딩 중…</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: 13 }}>주소가 매칭된 매출이 없습니다.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          {/* 시도별 가로 막대 */}
          <div>
            <div style={label}>시도별</div>
            <ResponsiveContainer width="100%" height={Math.max(220, sidoData.length * 26)}>
              <BarChart data={sidoData} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
                <CartesianGrid horizontal={false} stroke="var(--gray-200, #eee)" />
                <XAxis type="number" tickFormatter={(v: number) => (v >= 1e8 ? `${Math.round(v / 1e8)}억` : `${Math.round(v / 1e4)}만`)} fontSize={11} stroke="var(--text-tertiary)" />
                <YAxis type="category" dataKey="name" width={44} fontSize={11} stroke="var(--text-tertiary)" />
                <Tooltip formatter={(v: number) => [formatKrw(Number(v)), '매출']} />
                <Bar dataKey="sales" fill="#8B1538" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 구별 상위 15 */}
          <div>
            <div style={label}>구별 상위 15</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {guData.map((g) => (
                <div key={`${g.sido}|${g.gu}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ width: 110, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-secondary)' }}>
                    {g.sido} {g.gu}
                  </span>
                  <div style={{ flex: 1, height: 14, background: 'var(--surface-muted, #f3f0ee)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(2, (g.sales / guMax) * 100)}%`, height: '100%', background: '#8B1538', borderRadius: 4 }} />
                  </div>
                  <span style={{ width: 58, flexShrink: 0, textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>{formatKrw(g.sales)}</span>
                  <span style={{ width: 40, flexShrink: 0, textAlign: 'right', color: 'var(--text-tertiary)' }}>{g.clients}곳</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
