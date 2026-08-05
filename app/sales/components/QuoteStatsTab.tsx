'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid,
} from 'recharts';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import { PageHeader, Section, Stack, StatStripSkeleton, TableSkeleton } from '@/app/components/ui';

type Bucket = { key: string; label: string; quotes: number; clients: number; ordered: number; rate: number };

/** 견적성과 — 견적 발행(거래처) vs 발주(60일 내 견적 품목 출고) 시계열. */
export default function QuoteStatsTab({ currentManager, isAdmin, managerList }: {
  currentManager: string; isAdmin: boolean; managerList: string[];
}) {
  const [bucket, setBucket] = useState<'week' | 'month'>('week');
  const [months, setMonths] = useState(3);
  const [manager, setManager] = useState(isAdmin ? '' : currentManager);
  const [type, setType] = useState<'wine' | 'glass'>('wine');
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const p = new URLSearchParams({ type, bucket, months: String(months) });
        if (manager) p.set('manager', manager);
        const r = await fetch(`/api/sales/quote-stats?${p}`, { credentials: 'include' });
        const j = await r.json();
        if (alive) setBuckets(Array.isArray(j.buckets) ? j.buckets : []);
      } catch { if (alive) setBuckets([]); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [type, bucket, months, manager]);

  const total = buckets.reduce(
    (a, b) => ({ quotes: a.quotes + b.quotes, clients: a.clients + b.clients, ordered: a.ordered + b.ordered }),
    { quotes: 0, clients: 0, ordered: 0 },
  );
  const totalRate = total.clients ? Math.round((total.ordered / total.clients) * 1000) / 10 : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Sales"
        title="견적성과"
        subtitle="발행한 견적서가 몇 곳에 나갔고, 그중 몇 곳이 발주(견적 품목을 60일 내 유상 주문)했는지."
      />

      {/* 컨트롤 */}
      <div style={{ marginBottom: 20 }}>
        <Stack direction="horizontal" gap={8} align="center" wrap fullWidth>
          <Button size="sm" variant={type === 'wine' ? 'primary' : 'outline'} onClick={() => setType('wine')}>까브드뱅</Button>
          <Button size="sm" variant={type === 'glass' ? 'primary' : 'outline'} onClick={() => setType('glass')}>대유라이프</Button>
          <span style={{ width: 8 }} />
          <Button size="sm" variant={bucket === 'week' ? 'primary' : 'outline'} onClick={() => setBucket('week')}>주별</Button>
          <Button size="sm" variant={bucket === 'month' ? 'primary' : 'outline'} onClick={() => setBucket('month')}>월별</Button>
          <span style={{ width: 8 }} />
          {[3, 6, 12].map((m) => (
            <Button key={m} size="sm" variant={months === m ? 'primary' : 'outline'} onClick={() => setMonths(m)}>{m}개월</Button>
          ))}
          {isAdmin && (
            <select
              value={manager}
              onChange={(e) => setManager(e.target.value)}
              style={{
                marginLeft: 'auto', padding: '6px 10px', borderRadius: 8,
                border: '1px solid var(--border-default)', background: 'var(--surface)',
                color: 'var(--text-secondary)', fontSize: 13,
              }}
            >
              <option value="">전체 담당</option>
              {managerList.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
        </Stack>
      </div>

      {loading ? (
        <>
          <div style={{ marginBottom: 16 }}><StatStripSkeleton cells={4} /></div>
          <TableSkeleton rows={6} />
        </>
      ) : buckets.length === 0 ? (
        <Section bordered>
          <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
            기간 내 발행된 견적이 없어요.
          </div>
        </Section>
      ) : (
        <>
          {/* ── HERO: 발주 전환율 ── */}
          <div
            style={{
              display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'center',
              padding: '24px 28px', marginBottom: 16, borderRadius: 'var(--radius-xl, 16px)',
              background: 'var(--surface)', border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ minWidth: 220 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                발주 전환율
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 56, lineHeight: 1, fontWeight: 800, color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-display)' }}>
                  {totalRate}
                </span>
                <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-primary)' }}>%</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
                발행 <b style={{ color: 'var(--text-primary)' }}>{total.clients}곳</b> 중{' '}
                <b style={{ color: 'var(--text-primary)' }}>{total.ordered}곳</b>이 발주
              </div>
            </div>

            {/* 퍼널 + 진행바 */}
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                <span>발행 {total.clients}곳</span>
                <span>발주 {total.ordered}곳</span>
              </div>
              <div style={{ height: 12, borderRadius: 999, background: 'var(--surface-muted)', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, totalRate)}%`, height: '100%', borderRadius: 999, background: 'var(--color-primary)', transition: 'width .4s ease' }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
                기간 내 견적 <b style={{ color: 'var(--text-secondary)' }}>{total.quotes}건</b> 발행
              </div>
            </div>
          </div>

          {/* ── 보조 스탯 카드 ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
            {([
              ['견적 발행', `${total.quotes}`, '건'],
              ['발행 거래처', `${total.clients}`, '곳'],
              ['발주 거래처', `${total.ordered}`, '곳'],
            ] as [string, string, string][]).map(([label, value, unit]) => (
              <Card key={label} size="sm">
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 6 }}>{label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{unit}</span>
                </div>
              </Card>
            ))}
          </div>

          {/* 추이 차트 */}
          <div style={{ marginBottom: 16 }}>
            <Section title="발주 전환 추이" meta={`${bucket === 'week' ? '주별' : '월별'} · 최근 ${months}개월`}>
              <div style={{ width: '100%', height: 340 }}>
                <ResponsiveContainer>
                  <ComposedChart data={buckets} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                    <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={{ stroke: 'var(--border-default)' }} />
                    <YAxis yAxisId="cnt" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis yAxisId="pct" orientation="right" fontSize={11} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
                    <Tooltip
                      formatter={(v: number, name: string) => name === '발주율' ? [`${v}%`, name] : [`${v}곳`, name]}
                      labelStyle={{ fontWeight: 700 }}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border-default)' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="cnt" dataKey="clients" name="발행 거래처" fill="var(--gray-300)" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    <Bar yAxisId="cnt" dataKey="ordered" name="발주 거래처" fill="var(--text-primary)" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    <Line yAxisId="pct" dataKey="rate" name="발주율" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Section>
          </div>

          {/* 기간별 상세 */}
          <Section title="기간별 상세" padding="none">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                  {['기간', '견적', '발행 거래처', '발주 거래처', '발주율'].map((h, i) => (
                    <th key={h} style={{ padding: '9px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...buckets].reverse().map((b) => (
                  <tr key={b.key} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '9px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>{b.label}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{b.quotes}건</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{b.clients}곳</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{b.ordered}곳</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--color-primary)' }}>{b.rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </>
      )}
    </div>
  );
}
