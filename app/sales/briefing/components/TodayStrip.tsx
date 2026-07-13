'use client';

import { useEffect, useState } from 'react';

interface Summary {
  todayMeetings: Array<{ client_name: string }>;
  outstanding: { total: number; count: number };
  winback?: { sent: number; converted: number } | null;
}

/**
 * 브리핑 상단 '오늘' 스탯 스트립 — 박스 없이 상하 헤어라인 + 세로 구분.
 * 오늘 미팅 수 · 미수 거래처 수 · 미수 총액(빨간 숫자). 상세는 아래 브리핑 섹션들이 담당.
 */
export function TodayStrip() {
  const [s, setS] = useState<Summary | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/sales/briefing/summary')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j?.summary) setS(j.summary); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!s) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'stretch',
      borderTop: '1px solid var(--border-default)',
      borderBottom: '1px solid var(--border-default)',
      marginBottom: 20,
    }}>
      <Stat label="오늘 미팅" value={`${s.todayMeetings.length}건`} />
      <Stat label="미수 거래처" value={`${s.outstanding.count}곳`} divider />
      <Stat label="미수 총액" value={`${s.outstanding.total.toLocaleString()}원`} divider danger={s.outstanding.total > 0} />
      {s.winback && (
        <Stat
          label="윈백 (30일)"
          value={`${s.winback.sent}곳 → 재주문 ${s.winback.converted}`}
          divider
          danger={false}
        />
      )}
    </div>
  );
}

function Stat({ label, value, divider, danger }: { label: string; value: string; divider?: boolean; danger?: boolean }) {
  return (
    <div style={{ flex: 1, padding: '14px 18px', borderLeft: divider ? '1px solid var(--border-default)' : 'none' }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3, fontWeight: 600 }}>{label}</div>
      <div style={{
        fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em',
        color: danger ? 'var(--status-danger)' : 'var(--text-primary)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
    </div>
  );
}
