'use client';

import { memo } from 'react';
import type { CSSProperties } from 'react';
import { PAYMENT_TYPES, PAYMENT_TYPE_LABEL, type PaymentType } from '../../outstanding/lib/dueDate';

type Props = {
  clientCode: string;
  clientName: string;
  paymentType: PaymentType | null;
  saving: boolean;
  onSelect: (code: string, pt: PaymentType | null) => void;
};

// 한 거래처의 결제조건을 버튼 한 번으로 지정 (드롭다운보다 빠른 입력)
function PaymentTermRowBase({ clientCode, clientName, paymentType, saving, onSelect }: Props) {
  const opts: Array<{ value: PaymentType | null; label: string }> = [
    { value: null, label: '미지정' },
    ...PAYMENT_TYPES.map(t => ({ value: t, label: PAYMENT_TYPE_LABEL[t] })),
  ];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)',
      opacity: saving ? 0.5 : 1,
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', minWidth: 0, flex: '0 1 240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {clientName}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {opts.map(o => {
          const active = (paymentType ?? null) === o.value;
          return (
            <button
              key={o.label}
              onClick={() => onSelect(clientCode, o.value)}
              style={btnStyle(active, o.value === null)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function btnStyle(active: boolean, isNone: boolean): CSSProperties {
  return {
    padding: '6px 12px', fontSize: 13, fontWeight: active ? 700 : 500, borderRadius: 7, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--action)' : 'var(--border-default)'}`,
    background: active ? 'var(--action)' : 'var(--surface)',
    color: active ? '#fff' : isNone ? 'var(--text-tertiary)' : 'var(--text-secondary)',
    whiteSpace: 'nowrap',
  };
}

export const PaymentTermRow = memo(PaymentTermRowBase);
