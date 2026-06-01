'use client';

import type { CSSProperties } from 'react';
import type { CollItem, CollectionBriefing } from '../hooks/useCollectionBriefing';

const fmt = (n: number) => n.toLocaleString();
const ENTITY = (t: string) => (t === 'glass' ? '대유라이프' : '까브드뱅');

// 오늘의 수금 브리핑 — 약속어김 / 오늘약속 / 연체(특별관리)
export function CollectionBriefingSection({ data }: { data: CollectionBriefing }) {
  const { broken, promiseToday, overdue } = data;
  if (broken.length === 0 && promiseToday.length === 0 && overdue.length === 0) return null;

  return (
    <div style={{ marginBottom: 16, border: '1px solid var(--border-default)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-default)', fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>
        💰 오늘의 수금
        <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>
          약속어김 {broken.length} · 오늘약속 {promiseToday.length} · 연체 {overdue.length}
          {data.counts.special > 0 && <span style={{ color: '#dc2626' }}> (특별관리 {data.counts.special})</span>}
        </span>
      </div>

      <Block title="🚨 약속 어김" color="#dc2626" items={broken} mode="broken" />
      <Block title="📅 오늘 수금 약속" color="#2563eb" items={promiseToday} mode="today" />
      <Block title="⏰ 연체 (예정일 경과)" color="#d97706" items={overdue} mode="overdue" />
    </div>
  );
}

function Block({ title, color, items, mode }: { title: string; color: string; items: CollItem[]; mode: 'broken' | 'today' | 'overdue' }) {
  if (items.length === 0) return null;
  const shown = items.slice(0, 20);
  return (
    <div>
      <div style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, color, background: 'var(--surface)' }}>
        {title} <span style={{ color: 'var(--text-tertiary)' }}>({items.length})</span>
      </div>
      {shown.map(it => (
        <div key={`${it.client_code}|${it.client_type}`} style={rowStyle}>
          <div style={{ minWidth: 0, flex: '1 1 auto' }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{it.client_name}</span>
            {it.special && <span style={badge}>특별관리</span>}
            <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>{ENTITY(it.client_type)}</span>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color }}>
              {fmt(mode === 'today' ? it.net_balance : it.overdue || it.net_balance)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {mode === 'broken' && `약속 ${it.promised_date?.slice(2)} 경과`}
              {mode === 'today' && '오늘 수금'}
              {mode === 'overdue' && `${it.days_overdue}일 경과${it.stage > 0 ? ` · ${it.stage}차` : ''}`}
            </div>
          </div>
        </div>
      ))}
      {items.length > shown.length && (
        <div style={{ padding: '6px 16px', fontSize: 11, color: 'var(--text-muted)' }}>외 {items.length - shown.length}곳 — 미수현황 탭 참고</div>
      )}
    </div>
  );
}

const rowStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  padding: '8px 16px', borderTop: '1px solid var(--border-subtle)',
};
const badge: CSSProperties = {
  marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#fff', background: '#dc2626',
  borderRadius: 4, padding: '1px 5px', verticalAlign: 'middle',
};
