'use client';

import { useEffect, useState } from 'react';

interface Summary {
  todayMeetings: Array<{ client_name: string }>;
  outstanding: { total: number; count: number };
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
      <Stat label="미수 총액" value={`${s.outstanding.total.toLocaleString()}원`} divider danger={s.outstanding.total > 0} grow={1.7} />
    </div>
  );
}

function Stat({ label, value, divider, danger, grow = 1 }: { label: string; value: string; divider?: boolean; danger?: boolean; grow?: number }) {
  return (
    <div style={{
      flex: `${grow} 1 0`, minWidth: 0,
      padding: '12px 14px',
      borderLeft: divider ? '1px solid var(--border-default)' : 'none',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3, fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{
        // 미수 총액처럼 긴 숫자도 모바일 3열에서 줄바꿈 없이 — clamp로 축소
        fontSize: 'clamp(14px, 4.2vw, 19px)', fontWeight: 700, letterSpacing: '-0.01em',
        color: danger ? 'var(--status-danger)' : 'var(--text-primary)',
        fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
        overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {value}
      </div>
    </div>
  );
}
