'use client';

import { useEffect, useMemo, useState } from 'react';
import Card from '@/app/components/ui/Card';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from '../client-analysis/lib/recharts';

type ByDay = { date: string; total: number; escalated: number };
type ByTab = Record<string, { total: number; escalated: number }>;
type Stats = {
  days: number;
  total: number;
  escalated: number;
  baseCost: number;
  escalationCost: number;
  totalCost: number;
  byTab: ByTab;
  byDay: ByDay[];
};

const PERIODS = [
  { value: 7, label: '7일' },
  { value: 30, label: '30일' },
  { value: 90, label: '90일' },
] as const;

const usd = (n: number) => `~$${(n || 0).toFixed(2)}`;

/** 발주 파싱 에스컬레이션(정밀보정) 비율·비용 추세 */
export function ParseStatsTab() {
  const [days, setDays] = useState<number>(30);
  // stats === null = 로딩 중(초기/갱신 대기). 별도 loading 상태를 두지 않아 동기 setState 회피.
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/parse-stats?days=${days}`)
      .then((r) => r.json())
      .then((d) => { if (alive) setStats(d.success ? d.stats : null); })
      .catch(() => { if (alive) setStats(null); });
    return () => { alive = false; };
  }, [days]);

  const chartData = useMemo(
    () => (stats?.byDay || []).map((d) => ({
      date: d.date,
      total: d.total,
      rate: d.total > 0 ? Math.round((d.escalated / d.total) * 1000) / 10 : 0,
    })),
    [stats],
  );

  const rate = stats && stats.total > 0 ? (stats.escalated / stats.total) * 100 : 0;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>발주 AI · 정밀보정 추세</h2>
        <div style={{ display: 'flex', height: 28 }}>
          {PERIODS.map((o, idx) => {
            const active = days === o.value;
            return (
              <button
                key={o.value}
                onClick={() => setDays(o.value)}
                style={{
                  minWidth: 52, padding: '0 12px',
                  border: '1px solid var(--border-default)',
                  background: active ? 'var(--action)' : 'var(--surface)',
                  color: active ? 'var(--text-on-primary)' : 'var(--text-tertiary)',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  borderRadius: idx === 0 ? '6px 0 0 6px' : idx === PERIODS.length - 1 ? '0 6px 6px 0' : 0,
                  borderLeftWidth: idx === 0 ? 1 : 0,
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 요약 스탯 스트립 */}
      <div style={{
        display: 'flex', alignItems: 'stretch', overflowX: 'auto',
        borderTop: '1px solid var(--border-default)',
        borderBottom: '1px solid var(--border-default)',
        marginBottom: 20,
      }}>
        <SummaryCell label="발주 건수" value={(stats?.total ?? 0).toLocaleString()} />
        <SummaryCell label="정밀보정 비율" value={`${rate.toFixed(0)}%`} sub={`${(stats?.escalated ?? 0).toLocaleString()}건`} divider />
        <SummaryCell label="추정 총비용" value={usd(stats?.totalCost ?? 0)} divider />
        <SummaryCell label="추가 비용(에스컬레이션)" value={usd(stats?.escalationCost ?? 0)} accent divider />
      </div>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px' }}>일별 발주 건수 · 정밀보정 비율</h3>
        {stats === null ? (
          <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>불러오는 중…</div>
        ) : chartData.length === 0 ? (
          <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>아직 집계된 발주가 없습니다.</div>
        ) : (
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 50, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11 }} width={40} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11 }} width={45} domain={[0, 100]} />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === 'total' ? [`${value}건`, '발주'] : [`${value}%`, '정밀보정']}
                />
                <Legend formatter={(v: string) => (v === 'total' ? '발주 건수' : '정밀보정 비율')} />
                <Line yAxisId="left" type="monotone" dataKey="total" stroke="var(--action)" strokeWidth={2} dot={chartData.length < 40} name="total" animationDuration={400} />
                <Line yAxisId="right" type="monotone" dataKey="rate" stroke="#4f46e5" strokeWidth={2} dot={chartData.length < 40} name="rate" animationDuration={400} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* 법인별 */}
      {stats && Object.keys(stats.byTab || {}).length > 0 && (
        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>법인별</h3>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {Object.entries(stats.byTab).map(([t, v]) => {
              const r = v.total > 0 ? (v.escalated / v.total) * 100 : 0;
              const name = t === 'CDV' ? '까브드뱅(CDV)' : t === 'DL' ? '대유라이프(DL)' : t;
              return (
                <div key={t} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  <b style={{ color: 'var(--text-primary)' }}>{name}</b> · {v.total.toLocaleString()}건 · 정밀보정 {r.toFixed(0)}% ({v.escalated.toLocaleString()})
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 12, lineHeight: 1.6 }}>
        정밀보정 = 후보가 불확실해 상위 모델(Sonnet)로 재매칭한 발주. 추가 비용은 그 호출분 추정치입니다(단가는 추정).
        임계값(ESCALATE_CONF)을 올리면 비율↓·비용↓, 내리면 정확도↑.
      </p>
    </div>
  );
}

function SummaryCell({ label, value, sub, accent, divider }: { label: string; value: string; sub?: string; accent?: boolean; divider?: boolean }) {
  return (
    <div style={{
      flex: '1 0 auto', minWidth: 130, padding: '12px 16px',
      borderLeft: divider ? '1px solid var(--border-default)' : 'none',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{
        fontSize: 19, fontWeight: 700, marginTop: 3, letterSpacing: '-0.01em',
        fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
        color: accent ? 'var(--status-info)' : 'var(--text-primary)',
      }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, whiteSpace: 'nowrap' }}>{sub}</div>}
    </div>
  );
}
