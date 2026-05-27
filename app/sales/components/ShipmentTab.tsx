'use client';

import { useState, useEffect, useCallback } from 'react';
import { Section, Stack } from '@/app/components/ui';
import { inputStyle as ctlInput } from '@/app/styles/controls';

interface ShipItem {
  item_no: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
}

interface ShipClient {
  client_code: string;
  client_name: string;
  business_type: string;
  supply_amount: number;
  tax_amount: number;
  total_amount: number;
  items: ShipItem[];
}

interface ShipGroup {
  clients: ShipClient[];
  totals: { supply: number; tax: number; total: number };
  count: number;
}

function fmt(n: number) {
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '억';
  if (n >= 1e4) return Math.round(n / 1e4).toLocaleString() + '만';
  return n.toLocaleString();
}

function StatItem({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span
        style={{
          fontSize: 10,
          color: 'var(--text-tertiary)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: 3,
          fontSize: accent ? 22 : 15,
          fontWeight: 700,
          color: accent ? 'var(--action)' : 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
          fontFamily: "'DM Sans', sans-serif",
          lineHeight: 1.1,
        }}
      >
        {value}
        {unit && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--text-tertiary)',
            }}
          >
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}

function Divider() {
  return (
    <span
      style={{
        width: 1,
        height: 28,
        background: 'var(--border-default)',
        flexShrink: 0,
      }}
    />
  );
}

function ClientTable({ group, expandedClient, setExpandedClient, prefix }: {
  group: ShipGroup;
  expandedClient: string | null;
  setExpandedClient: (v: string | null) => void;
  prefix: string;
}) {
  if (group.clients.length === 0) {
    return <div style={{ padding: '16px 14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>출고 건이 없습니다</div>;
  }
  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            <tr style={{ background: '#fafaf8' }}>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>거래처</th>
              <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 600, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>업종</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>공급금액</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>부가세</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>합계</th>
            </tr>
          </thead>
        </table>
      </div>
      <div style={{ maxHeight: 400, overflowY: 'auto', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        {group.clients.map(c => {
          const key = prefix + (c.client_code || c.client_name);
          const isExp = expandedClient === key;
          return (
            <tbody key={key}>
              <tr
                onClick={() => setExpandedClient(isExp ? null : key)}
                style={{ cursor: 'pointer', borderBottom: isExp ? 'none' : '1px solid rgba(90,21,21,0.04)' }}
              >
                <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {isExp ? '▾ ' : '▸ '}{c.client_name}
                </td>
                <td style={{ padding: '8px 6px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{c.business_type || '-'}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', color: '#333', whiteSpace: 'nowrap' }}>{fmt(c.supply_amount)}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', color: '#999', whiteSpace: 'nowrap' }}>{fmt(c.tax_amount)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{fmt(c.total_amount)}</td>
              </tr>
              {isExp && (
                <>
                  <tr style={{ background: '#f8f6f4' }}>
                    <td style={{ padding: '4px 10px 4px 28px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>품목</td>
                    <td style={{ padding: '4px 6px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>품명</td>
                    <td style={{ padding: '4px 6px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>수량</td>
                    <td style={{ padding: '4px 6px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>단가</td>
                    <td style={{ padding: '4px 10px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>금액</td>
                  </tr>
                  {c.items.map((it, idx) => (
                    <tr key={idx} style={{ background: '#f8f6f4', borderBottom: idx === c.items.length - 1 ? 'none' : '1px solid rgba(90,21,21,0.03)' }}>
                      <td style={{ padding: '4px 10px 4px 28px', fontSize: 11, color: '#666' }}>{it.item_no}</td>
                      <td style={{ padding: '4px 6px', fontSize: 11, color: '#333', whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.item_name}</td>
                      <td style={{ padding: '4px 6px', fontSize: 11, color: '#333', textAlign: 'right' }}>{it.quantity}</td>
                      <td style={{ padding: '4px 6px', fontSize: 11, color: '#999', textAlign: 'right' }}>{fmt(it.unit_price)}</td>
                      <td style={{ padding: '4px 10px', fontSize: 11, color: '#333', textAlign: 'right', fontWeight: 600 }}>{fmt(it.total_amount)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#f8f6f4', borderBottom: '1px solid rgba(90,21,21,0.06)' }}>
                    <td colSpan={4} style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textAlign: 'right' }}>소계</td>
                    <td style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>{fmt(c.total_amount)}</td>
                  </tr>
                </>
              )}
            </tbody>
          );
        })}
        </table>
      </div>
      <div style={{ overflowX: 'auto', borderTop: '2px solid rgba(90,21,21,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <tfoot>
            <tr>
              <td colSpan={2} style={{ padding: '10px', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>합계</td>
              <td style={{ padding: '10px 6px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#333' }}>{fmt(group.totals.supply)}</td>
              <td style={{ padding: '10px 6px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#999' }}>{fmt(group.totals.tax)}</td>
              <td style={{ padding: '10px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#1a237e' }}>{fmt(group.totals.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default function ShipmentTab({ currentManager, isAdmin }: { currentManager: string; isAdmin: boolean }) {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = kstNow.toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);

  const presets: { label: string; from: string; to: string }[] = (() => {
    const y = kstNow.getUTCFullYear(), m = kstNow.getUTCMonth(), d = kstNow.getUTCDate();
    const pad = (n: number) => String(n).padStart(2, '0');
    // 이번 주 (월~일)
    const day = kstNow.getUTCDay();
    const mon = new Date(Date.UTC(y, m, d - (day === 0 ? 6 : day - 1)));
    const weekFrom = `${mon.getUTCFullYear()}-${pad(mon.getUTCMonth() + 1)}-${pad(mon.getUTCDate())}`;
    // 이번 달
    const monthFrom = `${y}-${pad(m + 1)}-01`;
    // 지난 달
    const pm = m === 0 ? 11 : m - 1;
    const py = m === 0 ? y - 1 : y;
    const lastDay = new Date(py, pm + 1, 0).getDate();
    const prevMonthFrom = `${py}-${pad(pm + 1)}-01`;
    const prevMonthTo = `${py}-${pad(pm + 1)}-${pad(lastDay)}`;
    // 이번 분기
    const qStart = Math.floor(m / 3) * 3;
    const qFrom = `${y}-${pad(qStart + 1)}-01`;
    // 내일
    const tmr = new Date(Date.UTC(y, m, d + 1));
    const tomorrowStr = `${tmr.getUTCFullYear()}-${pad(tmr.getUTCMonth() + 1)}-${pad(tmr.getUTCDate())}`;
    // 올해
    const yearFrom = `${y}-01-01`;
    return [
      { label: '내일', from: tomorrowStr, to: tomorrowStr },
      { label: '오늘', from: todayStr, to: todayStr },
      { label: '이번 주', from: weekFrom, to: todayStr },
      { label: '이번 달', from: monthFrom, to: todayStr },
      { label: '지난 달', from: prevMonthFrom, to: prevMonthTo },
      { label: '이번 분기', from: qFrom, to: todayStr },
      { label: '올해', from: yearFrom, to: todayStr },
    ];
  })();
  const [wine, setWine] = useState<ShipGroup | null>(null);
  const [glass, setGlass] = useState<ShipGroup | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentManager) return;
    setLoading(true);
    setExpandedClient(null);
    try {
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
      if (!isAdmin) params.set('manager', currentManager);
      const res = await fetch(`/api/sales/shipments/today?${params}`);
      const json = await res.json();
      setWine(json.wine || { clients: [], totals: { supply: 0, tax: 0, total: 0 }, count: 0 });
      setGlass(json.glass || { clients: [], totals: { supply: 0, tax: 0, total: 0 }, count: 0 });
    } catch {
      const empty = { clients: [], totals: { supply: 0, tax: 0, total: 0 }, count: 0 };
      setWine(empty);
      setGlass(empty);
    } finally {
      setLoading(false);
    }
  }, [currentManager, isAdmin, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const dateLabel = (() => {
    const f = new Date(dateFrom);
    const t = new Date(dateTo);
    const fStr = `${f.getMonth() + 1}/${f.getDate()}`;
    const tStr = `${t.getMonth() + 1}/${t.getDate()}`;
    return dateFrom === dateTo ? fStr : `${fStr} ~ ${tStr}`;
  })();

  const totalCount = (wine?.count || 0) + (glass?.count || 0);
  const totalClients = (wine?.clients.length || 0) + (glass?.clients.length || 0);
  const grandTotal = (wine?.totals.total || 0) + (glass?.totals.total || 0);

  return (
    <Stack direction="vertical" gap={16}>
      {/* 날짜 범위 + 프리셋 — 통일 input/buttons */}
      <Section padding="md">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ ...ctlInput, width: 150 }}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>~</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{ ...ctlInput, width: 150 }}
          />
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {presets.map((preset) => {
              const active = dateFrom === preset.from && dateTo === preset.to;
              return (
                <button
                  key={preset.label}
                  onClick={() => {
                    setDateFrom(preset.from);
                    setDateTo(preset.to);
                  }}
                  style={{
                    height: 28,
                    padding: '0 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: active ? 700 : 500,
                    border: `1px solid ${active ? 'var(--action)' : 'var(--border-default)'}`,
                    background: active ? 'var(--surface-active)' : 'var(--surface)',
                    color: active ? 'var(--action)' : 'var(--text-tertiary)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      {/* 요약 stat row — 컴팩트한 한 줄 (4개 stat) */}
      <Section padding="sm">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            flexWrap: 'wrap',
          }}
        >
          <StatItem label="기간" value={dateLabel} />
          <Divider />
          <StatItem
            label="거래처"
            value={loading ? '—' : String(totalClients)}
            unit="개"
          />
          <Divider />
          <StatItem
            label="출고"
            value={loading ? '—' : String(totalCount)}
            unit="건"
          />
          <div style={{ flex: 1 }} />
          {grandTotal > 0 && (
            <StatItem label="총 합계" value={fmt(grandTotal)} accent />
          )}
        </div>
      </Section>

      {loading && (
        <Section padding="md">
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            로딩 중...
          </div>
        </Section>
      )}

      {!loading && wine && glass && (
        <>
          <Section
            title="까브드뱅"
            meta={`${wine.count}건${wine.totals.total > 0 ? ` · ${fmt(wine.totals.total)}` : ''}`}
            padding="none"
          >
            <ClientTable
              group={wine}
              expandedClient={expandedClient}
              setExpandedClient={setExpandedClient}
              prefix="w_"
            />
          </Section>

          <Section
            title="대유라이프"
            meta={`${glass.count}건${glass.totals.total > 0 ? ` · ${fmt(glass.totals.total)}` : ''}`}
            padding="none"
          >
            <ClientTable
              group={glass}
              expandedClient={expandedClient}
              setExpandedClient={setExpandedClient}
              prefix="g_"
            />
          </Section>
        </>
      )}
    </Stack>
  );
}
