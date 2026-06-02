'use client';

import { useState, Fragment } from 'react';
import type { CSSProperties } from 'react';
import type { CollItem, CollectionBriefing } from '../hooks/useCollectionBriefing';
import { LedgerPopup } from './LedgerPopup';
import type { LedgerType } from '@/app/sales/ledger/types';

const fmt = (n: number) => n.toLocaleString();
const keyOf = (it: CollItem) => `${it.client_code}|${it.client_type}`;
const todayKST = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const daysSince = (d: string) => Math.max(0, Math.floor((Date.now() + 9 * 3600 * 1000 - new Date(d).getTime()) / 86400000));

type SaveFn = (clientCode: string, clientType: string, patch: Record<string, unknown>) => void;
type OpenLedgerFn = (it: CollItem) => void;
type Ctx = { editing: string | null; setEditing: (k: string | null) => void; onSave?: SaveFn; onOpenLedger: OpenLedgerFn };

// 원장 시작월 = 미결제 출고가 속한 달의 1일 (없으면 2개월 전)
function ledgerStart(it: CollItem): string {
  if (it.oldest_unpaid_date) return `${it.oldest_unpaid_date.slice(0, 7)}-01`;
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  d.setUTCMonth(d.getUTCMonth() - 2);
  return `${d.toISOString().slice(0, 7)}-01`;
}

// 오늘의 수금 브리핑 — 까브드뱅/대유라이프 분리, 각 약속어김/오늘약속/연체.
const GROUPS: Array<{ type: string; label: string; color: string }> = [
  { type: 'wine', label: '까브드뱅', color: '#8B1538' },
  { type: 'glass', label: '대유라이프', color: '#1565C0' },
];

export function CollectionBriefingSection({ data, onSave }: { data: CollectionBriefing; onSave?: SaveFn }) {
  const { broken, promiseToday, overdue } = data;
  const [editing, setEditing] = useState<string | null>(null);
  const [ledger, setLedger] = useState<CollItem | null>(null);
  if (broken.length === 0 && promiseToday.length === 0 && overdue.length === 0) return null;

  const ctx: Ctx = { editing, setEditing, onSave, onOpenLedger: setLedger };

  return (
    <div style={{ marginBottom: 12, background: '#fff', border: '1px solid rgba(90,21,21,0.06)', boxShadow: '0 1px 3px rgba(90,21,21,0.03)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', background: 'var(--surface-muted)', borderBottom: '1px solid rgba(90,21,21,0.06)', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
        💰 오늘의 수금
        <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>
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
            <div style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, color: '#fff', background: g.color }}>
              {g.label} <span style={{ fontWeight: 600, opacity: 0.85 }}>({gb.length + gt.length + go.length})</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#fafaf8' }}>
                    <th style={thL}>거래처</th>
                    <th style={thR}>예정일</th>
                    <th style={thR}>금액</th>
                    <th style={thR}>경과</th>
                    <th style={thR}>미수</th>
                  </tr>
                </thead>
                <tbody>
                  <Section title="🚨 약속 어김" color="#dc2626" items={gb} mode="broken" {...ctx} />
                  <Section title="📅 오늘 수금 약속" color="#2563eb" items={gt} mode="today" {...ctx} />
                  <Section title="⏰ 연체 (예정일 경과)" color="#d97706" items={go} mode="overdue" {...ctx} />
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {ledger && (
        <LedgerPopup
          clientCode={ledger.client_code}
          clientName={ledger.client_name}
          type={ledger.client_type as LedgerType}
          startDate={ledgerStart(ledger)}
          endDate={todayKST()}
          onClose={() => setLedger(null)}
        />
      )}
    </div>
  );
}

type SectionProps = Ctx & { title: string; color: string; items: CollItem[]; mode: 'broken' | 'today' | 'overdue' };

function Section({ title, color, items, mode, editing, setEditing, onSave, onOpenLedger }: SectionProps) {
  if (items.length === 0) return null;
  const shown = items.slice(0, 20);
  return (
    <>
      <tr><td colSpan={5} style={{ padding: '5px 12px', fontSize: 11, fontWeight: 700, color, background: '#fafaf8' }}>{title} <span style={{ color: 'var(--text-tertiary)' }}>({items.length})</span></td></tr>
      {shown.map(it => {
        const k = keyOf(it);
        const isEditing = editing === k;
        // 예정일: 연체=결제예정일, 오늘약속·약속어김=약속일
        const dateStr = mode === 'overdue' ? it.due_date : it.promised_date;
        const elapsed = mode === 'today' ? '오늘'
          : mode === 'broken' ? (it.promised_date ? `${daysSince(it.promised_date)}일` : '-')
          : `${it.days_overdue}일${it.stage > 0 ? `·${it.stage}차` : ''}`;
        return (
          <Fragment key={k}>
            <tr onClick={() => setEditing(isEditing ? null : k)} style={{ cursor: 'pointer', borderTop: '1px solid rgba(90,21,21,0.04)' }}>
              <td style={tdL}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{it.client_name}</span>
                {it.special && <span style={badge}>특별관리</span>}
              </td>
              <td style={{ ...tdR, color: 'var(--text-muted)' }}>{dateStr ? dateStr.slice(5) : '-'}</td>
              <td style={{ ...tdR, color: it.promised_amount != null ? '#16a34a' : 'var(--text-muted)', fontWeight: 700 }}>{it.promised_amount != null ? fmt(it.promised_amount) : '-'}</td>
              <td style={{ ...tdR, color, fontWeight: 600 }}>{elapsed}</td>
              <td style={{ ...tdR, fontWeight: 700, color }}>{fmt(it.net_balance)}</td>
            </tr>
            {isEditing && (
              <tr><td colSpan={5} style={{ padding: 0 }}>
                <Editor item={it} onSave={onSave} onClose={() => setEditing(null)} onOpenLedger={onOpenLedger} />
              </td></tr>
            )}
          </Fragment>
        );
      })}
      {items.length > shown.length && (
        <tr><td colSpan={5} style={{ padding: '5px 12px', fontSize: 10, color: 'var(--text-muted)' }}>외 {items.length - shown.length}곳 — 미수현황 탭 참고</td></tr>
      )}
    </>
  );
}

function Editor({ item, onSave, onClose, onOpenLedger }: { item: CollItem; onSave?: SaveFn; onClose: () => void; onOpenLedger: OpenLedgerFn }) {
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
      <button onClick={() => onOpenLedger(item)} style={ledgerBtn}>📄 원장 보기</button>
      {onSave && (
        <>
          <label style={lbl}>수금일</label>
          <input type="date" value={date} onChange={e => onDateChange(e.target.value)} style={inp} />
          <label style={lbl}>금액</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} style={{ ...inp, width: 120, textAlign: 'right' }} />
          <button
            onClick={() => { onSave(item.client_code, item.client_type, { promised_date: date || null, promised_amount: amount === '' ? null : Math.trunc(Number(amount)) }); onClose(); }}
            style={{ padding: '5px 12px', fontSize: 12, fontWeight: 700, borderRadius: 6, border: 'none', background: 'var(--action)', color: '#fff', cursor: 'pointer' }}
          >저장</button>
        </>
      )}
      <button onClick={onClose} style={{ padding: '5px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer' }}>닫기</button>
    </div>
  );
}

const thL: CSSProperties = { padding: '7px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' };
const thR: CSSProperties = { ...thL, textAlign: 'right' };
const tdL: CSSProperties = { padding: '7px 12px', textAlign: 'left', whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12 };
const tdR: CSSProperties = { padding: '7px 12px', textAlign: 'right', whiteSpace: 'nowrap', fontSize: 12, fontVariantNumeric: 'tabular-nums' };
const badge: CSSProperties = { marginLeft: 6, fontSize: 9, fontWeight: 700, color: '#fff', background: '#dc2626', borderRadius: 4, padding: '1px 4px', verticalAlign: 'middle' };
const lbl: CSSProperties = { fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 700 };
const ledgerBtn: CSSProperties = { padding: '5px 12px', fontSize: 12, fontWeight: 700, borderRadius: 6, border: '1px solid var(--action)', background: 'var(--surface)', color: 'var(--action)', cursor: 'pointer' };
const inp: CSSProperties = { padding: '5px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--surface)', color: 'var(--text-primary)' };
