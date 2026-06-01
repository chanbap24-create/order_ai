'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { CollItem, CollectionBriefing } from '../hooks/useCollectionBriefing';

const fmt = (n: number) => n.toLocaleString();
const keyOf = (it: CollItem) => `${it.client_code}|${it.client_type}`;

type SaveFn = (clientCode: string, clientType: string, patch: Record<string, unknown>) => void;

// 오늘의 수금 브리핑 — 까브드뱅/대유라이프 분리, 각 약속어김/오늘약속/연체.
const GROUPS: Array<{ type: string; label: string; color: string }> = [
  { type: 'wine', label: '까브드뱅', color: '#8B1538' },
  { type: 'glass', label: '대유라이프', color: '#1565C0' },
];

export function CollectionBriefingSection({ data, onSave }: { data: CollectionBriefing; onSave?: SaveFn }) {
  const { broken, promiseToday, overdue } = data;
  const [editing, setEditing] = useState<string | null>(null);
  if (broken.length === 0 && promiseToday.length === 0 && overdue.length === 0) return null;

  const blockProps = { editing, setEditing, onSave };

  return (
    <div style={{ marginBottom: 16, border: '1px solid var(--border-default)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-default)', fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>
        💰 오늘의 수금
        <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>
          약속어김 {broken.length} · 오늘약속 {promiseToday.length} · 연체 {overdue.length}
          {data.counts.special > 0 && <span style={{ color: '#dc2626' }}> (특별관리 {data.counts.special})</span>}
        </span>
      </div>

      {GROUPS.map(g => {
        const gb = broken.filter(x => x.client_type === g.type);
        const gt = promiseToday.filter(x => x.client_type === g.type);
        const go = overdue.filter(x => x.client_type === g.type);
        if (gb.length + gt.length + go.length === 0) return null;
        return (
          <div key={g.type}>
            <div style={{ padding: '8px 16px', fontSize: 13, fontWeight: 800, color: '#fff', background: g.color }}>
              {g.label} <span style={{ fontWeight: 600, opacity: 0.85 }}>({gb.length + gt.length + go.length})</span>
            </div>
            <Block title="🚨 약속 어김" color="#dc2626" items={gb} mode="broken" {...blockProps} />
            <Block title="📅 오늘 수금 약속" color="#2563eb" items={gt} mode="today" {...blockProps} />
            <Block title="⏰ 연체 (예정일 경과)" color="#d97706" items={go} mode="overdue" {...blockProps} />
          </div>
        );
      })}
    </div>
  );
}

type BlockProps = {
  title: string; color: string; items: CollItem[]; mode: 'broken' | 'today' | 'overdue';
  editing: string | null; setEditing: (k: string | null) => void; onSave?: SaveFn;
};

function Block({ title, color, items, mode, editing, setEditing, onSave }: BlockProps) {
  if (items.length === 0) return null;
  const shown = items.slice(0, 20);
  return (
    <div>
      <div style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, color, background: 'var(--surface)' }}>
        {title} <span style={{ color: 'var(--text-tertiary)' }}>({items.length})</span>
      </div>
      {shown.map(it => {
        const k = keyOf(it);
        const isEditing = editing === k;
        return (
          <div key={k}>
            <div style={rowStyle} onClick={() => onSave && setEditing(isEditing ? null : k)}>
              <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{it.client_name}</span>
                {it.special && <span style={badge}>특별관리</span>}
                {it.promised_amount != null && <span style={{ marginLeft: 6, fontSize: 11, color: '#2563eb', fontWeight: 700 }}>약속 {fmt(it.promised_amount)}</span>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color }}>{fmt(mode === 'today' ? it.net_balance : it.overdue || it.net_balance)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {mode === 'broken' && `약속 ${it.promised_date?.slice(2)} 경과`}
                  {mode === 'today' && '오늘 수금'}
                  {mode === 'overdue' && `${it.days_overdue}일 경과${it.stage > 0 ? ` · ${it.stage}차` : ''}`}
                </div>
              </div>
            </div>
            {isEditing && onSave && <Editor item={it} onSave={onSave} onClose={() => setEditing(null)} />}
          </div>
        );
      })}
      {items.length > shown.length && (
        <div style={{ padding: '6px 16px', fontSize: 11, color: 'var(--text-muted)' }}>외 {items.length - shown.length}곳 — 미수현황 탭 참고</div>
      )}
    </div>
  );
}

function Editor({ item, onSave, onClose }: { item: CollItem; onSave: SaveFn; onClose: () => void }) {
  const defAmt = item.promised_amount ?? (item.overdue > 0 ? item.overdue : item.net_balance);
  const [date, setDate] = useState(item.promised_date ?? '');
  const [amount, setAmount] = useState(String(defAmt));

  // 수금일 변경 시 그 날짜 기준 미수로 금액 재계산
  const onDateChange = async (d: string) => {
    setDate(d);
    if (!d) return;
    try {
      const res = await fetch(`/api/sales/collections/balance?client_code=${encodeURIComponent(item.client_code)}&type=${item.client_type}&date=${d}`);
      const j = await res.json();
      if (typeof j.balance === 'number') setAmount(String(j.balance));
    } catch { /* ignore */ }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'var(--surface-muted)', borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
      <label style={lbl}>수금일</label>
      <input type="date" value={date} onChange={e => onDateChange(e.target.value)} style={inp} />
      <label style={lbl}>금액</label>
      <input type="number" value={amount} onChange={e => setAmount(e.target.value)} style={{ ...inp, width: 120, textAlign: 'right' }} />
      <button
        onClick={() => { onSave(item.client_code, item.client_type, { promised_date: date || null, promised_amount: amount === '' ? null : Math.trunc(Number(amount)) }); onClose(); }}
        style={{ padding: '5px 12px', fontSize: 12, fontWeight: 700, borderRadius: 6, border: 'none', background: 'var(--action)', color: '#fff', cursor: 'pointer' }}
      >저장</button>
      <button onClick={onClose} style={{ padding: '5px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer' }}>취소</button>
    </div>
  );
}

const rowStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  padding: '8px 16px', borderTop: '1px solid var(--border-subtle)', cursor: 'pointer',
};
const badge: CSSProperties = { marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#fff', background: '#dc2626', borderRadius: 4, padding: '1px 5px', verticalAlign: 'middle' };
const lbl: CSSProperties = { fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 700 };
const inp: CSSProperties = { padding: '5px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--surface)', color: 'var(--text-primary)' };
