'use client';

import { useRef } from 'react';
import type { CSSProperties } from 'react';
import type { Followup, FollowupStatus, OutstandingType } from '../types';

type Props = {
  clientCode: string;
  clientType: OutstandingType;
  followup?: Followup;
  /** 약속 금액 기본값(미설정 시 prefill) — 보통 연체/미수금 */
  defaultAmount?: number;
  onSave: (clientCode: string, patch: Partial<Followup>) => void;
};

const STATUS_LABEL: Record<FollowupStatus, string> = {
  open: '미처리', promised: '약속', paid: '완납', hold: '보류',
};
const STATUS_COLOR: Record<FollowupStatus, string> = {
  open: 'var(--text-tertiary)', promised: '#2563eb', paid: '#16a34a', hold: '#d97706',
};

// 행별 수금 워크플로우 입력: 독촉 차수 / 상태 / 약속일 / 메모
export function FollowupCell({ clientCode, clientType, followup, defaultAmount, onSave }: Props) {
  const stage = followup?.stage ?? 0;
  const status = followup?.status ?? 'open';
  const amtDefault = followup?.promised_amount ?? (defaultAmount && defaultAmount > 0 ? defaultAmount : null);
  const amtRef = useRef<HTMLInputElement>(null);

  // 수금일 변경 → 그 날짜 기준 미수로 금액 재계산
  const onDateChange = async (d: string) => {
    onSave(clientCode, { promised_date: d || null });
    if (!d) return;
    try {
      const res = await fetch(`/api/sales/collections/balance?client_code=${encodeURIComponent(clientCode)}&type=${clientType}&date=${d}`);
      const j = await res.json();
      if (typeof j.balance === 'number') {
        if (amtRef.current) amtRef.current.value = String(j.balance);
        onSave(clientCode, { promised_amount: j.balance });
      }
    } catch { /* ignore */ }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
      <select
        aria-label="독촉 차수"
        value={stage}
        onChange={e => onSave(clientCode, { stage: Number(e.target.value) })}
        style={{ ...selStyle, color: stage > 0 ? '#dc2626' : 'var(--text-tertiary)', fontWeight: stage > 0 ? 700 : 400 }}
      >
        <option value={0}>독촉–</option>
        <option value={1}>1차</option>
        <option value={2}>2차</option>
        <option value={3}>3차</option>
      </select>

      <select
        aria-label="수금 상태"
        value={status}
        onChange={e => onSave(clientCode, { status: e.target.value as FollowupStatus })}
        style={{ ...selStyle, color: STATUS_COLOR[status], fontWeight: 700 }}
      >
        {(Object.keys(STATUS_LABEL) as FollowupStatus[]).map(s => (
          <option key={s} value={s}>{STATUS_LABEL[s]}</option>
        ))}
      </select>

      <input
        type="date"
        aria-label="수금 약속일"
        value={followup?.promised_date ?? ''}
        onChange={e => onDateChange(e.target.value)}
        style={{ ...inputStyle, width: 120 }}
      />

      <input
        ref={amtRef}
        type="number"
        aria-label="수금 약속 금액"
        placeholder="금액"
        defaultValue={amtDefault ?? ''}
        key={`amt-${clientCode}-${amtDefault ?? ''}`}
        onBlur={e => {
          const v = e.target.value.trim();
          const num = v === '' ? null : Math.trunc(Number(v));
          if (num !== (followup?.promised_amount ?? null)) onSave(clientCode, { promised_amount: num });
        }}
        style={{ ...inputStyle, width: 96, textAlign: 'right' }}
      />

      <input
        type="text"
        aria-label="메모"
        placeholder="메모"
        defaultValue={followup?.memo ?? ''}
        onBlur={e => {
          const v = e.target.value.trim();
          if (v !== (followup?.memo ?? '')) onSave(clientCode, { memo: v || null });
        }}
        style={{ ...inputStyle, width: 110 }}
      />
    </div>
  );
}

const selStyle: CSSProperties = {
  padding: '4px 6px', fontSize: 12, borderRadius: 6, flexShrink: 0,
  border: '1px solid var(--border-default)', background: 'var(--surface)', color: 'var(--text-secondary)',
};
const inputStyle: CSSProperties = {
  padding: '4px 6px', fontSize: 12, borderRadius: 6, flexShrink: 0,
  border: '1px solid var(--border-default)', background: 'var(--surface)', color: 'var(--text-primary)',
};
