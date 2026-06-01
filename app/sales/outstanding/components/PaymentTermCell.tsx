'use client';

import type { CSSProperties } from 'react';
import type { Followup } from '../types';
import { PAYMENT_TYPES, PAYMENT_TYPE_LABEL, computeDueDate, type PaymentType } from '../lib/dueDate';

type Props = {
  clientCode: string;
  paymentType: PaymentType | null;
  // 수금 예정일 계산 기준일(가장 오래된 미수 건의 발생일)
  baseDate: string | null;
  today: string;
  onSave: (clientCode: string, patch: Partial<Followup>) => void;
};

// 거래처 결제 조건(수금일) 선택 + 계산된 수금 예정일 표시
export function PaymentTermCell({ clientCode, paymentType, baseDate, today, onSave }: Props) {
  const due = computeDueDate(paymentType, baseDate);
  const overdue = due !== null && due < today;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <select
        aria-label="결제 조건"
        value={paymentType ?? ''}
        onChange={e => onSave(clientCode, { payment_type: (e.target.value || null) as PaymentType | null })}
        style={selStyle}
      >
        <option value="">미지정</option>
        {PAYMENT_TYPES.map(t => (
          <option key={t} value={t}>{PAYMENT_TYPE_LABEL[t]}</option>
        ))}
      </select>
      <span style={{
        fontSize: 12, fontVariantNumeric: 'tabular-nums',
        color: paymentType === 'prepay' ? '#2563eb' : overdue ? '#dc2626' : due ? 'var(--text-secondary)' : 'var(--text-tertiary)',
        fontWeight: overdue ? 700 : 400,
      }}>
        {paymentType === 'prepay' ? '선결제' : due ? `${due.slice(2)}${overdue ? ' 경과' : ''}` : '–'}
      </span>
    </div>
  );
}

const selStyle: CSSProperties = {
  padding: '4px 6px', fontSize: 12, borderRadius: 6,
  border: '1px solid var(--border-default)', background: 'var(--surface)', color: 'var(--text-secondary)',
};
