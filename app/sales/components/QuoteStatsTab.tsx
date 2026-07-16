'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid,
} from 'recharts';

type Bucket = { key: string; label: string; quotes: number; clients: number; ordered: number; rate: number };

const btn = (on: boolean): React.CSSProperties => ({
  padding: '5px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  border: `1px solid ${on ? 'var(--action)' : 'var(--gray-300)'}`,
  background: on ? 'var(--action)' : '#fff', color: on ? '#fff' : 'var(--text-tertiary)',
});

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
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>견적성과</div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>
        발행한 견적서가 몇 곳에 나갔고, 그중 몇 곳이 발주(견적 품목을 60일 내 유상 주문)했는지.
        최근 견적은 아직 전환 집계 중일 수 있어요.
      </div>

      {/* 컨트롤 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button onClick={() => setType('wine')} style={btn(type === 'wine')}>까브드뱅</button>
        <button onClick={() => setType('glass')} style={btn(type === 'glass')}>대유라이프</button>
        <span style={{ width: 8 }} />
        <button onClick={() => setBucket('week')} style={btn(bucket === 'week')}>주별</button>
        <button onClick={() => setBucket('month')} style={btn(bucket === 'month')}>월별</button>
        <span style={{ width: 8 }} />
        {[3, 6, 12].map((m) => (
          <button key={m} onClick={() => setMonths(m)} style={btn(months === m)}>{m}개월</button>
        ))}
        {isAdmin && (
          <select
            value={manager}
            onChange={(e) => setManager(e.target.value)}
            style={{ marginLeft: 'auto', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--gray-300)', fontSize: 13 }}
          >
            <option value="">전체 담당</option>
            {managerList.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
      </div>

      {/* 합계 스트립 */}
      <div style={{
        display: 'flex', gap: 24, flexWrap: 'wrap', padding: '12px 16px', marginBottom: 16,
        border: '1px solid var(--border-default)', borderRadius: 12, background: '#fff',
      }}>
        {[
          ['견적', `${total.quotes}건`],
          ['발행 거래처', `${total.clients}곳`],
          ['발주 거래처', `${total.ordered}곳`],
          ['발주율', `${totalRate}%`],
        ].map(([l, v]) => (
          <div key={l}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700 }}>{l}</div>
            <div style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
          </div>
        ))}
      </div>

      {/* 차트 */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>불러오는 중…</div>
      ) : buckets.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>기간 내 발행된 견적이 없어요.</div>
      ) : (
        <>
          <div style={{ width: '100%', height: 320, background: '#fff', border: '1px solid var(--border-default)', borderRadius: 12, padding: '16px 8px 8px' }}>
            <ResponsiveContainer>
              <ComposedChart data={buckets} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={{ stroke: '#ddd' }} />
                <YAxis yAxisId="cnt" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis yAxisId="pct" orientation="right" fontSize={11} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
                <Tooltip
                  formatter={(v: number, name: string) => name === '발주율' ? [`${v}%`, name] : [`${v}곳`, name]}
                  labelStyle={{ fontWeight: 700 }}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="cnt" dataKey="clients" name="발행 거래처" fill="#c9c4bc" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Bar yAxisId="cnt" dataKey="ordered" name="발주 거래처" fill="#111" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Line yAxisId="pct" dataKey="rate" name="발주율" stroke="#b0413e" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* 상세 표 */}
          <div style={{ marginTop: 16, background: '#fff', border: '1px solid var(--border-default)', borderRadius: 12, overflow: 'hidden' }}>
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
                  <tr key={b.key} style={{ borderBottom: '1px solid var(--border-default)' }}>
                    <td style={{ padding: '9px 14px', fontWeight: 600 }}>{b.label}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{b.quotes}건</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{b.clients}곳</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{b.ordered}곳</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{b.rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
