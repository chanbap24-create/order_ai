'use client';

import type { OutstandingType } from '../types';
import { Section } from '@/app/components/ui';

type Props = {
  startDate: string;
  endDate: string;
  type: OutstandingType;
  loading: boolean;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  onTypeChange: (t: OutstandingType) => void;
  onSearch: () => void;
  /** isAdmin/sales_admin 만 매니저 드롭다운 노출. 일반 user 에겐 undefined */
  managers?: string[];
  selectedManager?: string;
  onManagerChange?: (m: string) => void;
};

const fieldLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-tertiary)',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  marginBottom: 4,
  display: 'block',
};
const fieldInput: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid var(--border-default)',
  fontSize: 13,
  outline: 'none',
  background: 'var(--surface)',
  color: 'var(--text-primary)',
  width: '100%',
  height: 34,
  boxSizing: 'border-box',
};

export function FilterPanel(p: Props) {
  return (
    <Section padding="sm">
      <div
        style={{
          display: 'flex',
          alignItems: 'end',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {p.managers && p.managers.length > 0 && p.onManagerChange && (
          <Field label="담당자" minWidth={140}>
            <select
              value={p.selectedManager || ''}
              onChange={(e) => p.onManagerChange?.(e.target.value)}
              style={fieldInput}
            >
              {p.managers.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="시작일" minWidth={140}>
          <input
            type="date"
            value={p.startDate}
            onChange={(e) => p.onStartDateChange(e.target.value)}
            style={fieldInput}
          />
        </Field>

        <Field label="종료일" minWidth={140}>
          <input
            type="date"
            value={p.endDate}
            onChange={(e) => p.onEndDateChange(e.target.value)}
            style={fieldInput}
          />
        </Field>

        <Field label="구분" minWidth={140}>
          <div style={{ display: 'flex', height: 34 }}>
            {([
              { value: 'wine', label: '까브드뱅' },
              { value: 'glass', label: '대유라이프' },
            ] as const).map((o, idx) => {
              const isActive = p.type === o.value;
              return (
                <button
                  key={o.value}
                  onClick={() => p.onTypeChange(o.value)}
                  style={{
                    flex: 1,
                    border: '1px solid var(--border-default)',
                    background: isActive ? 'var(--action)' : 'var(--surface)',
                    color: isActive ? 'var(--text-on-primary)' : 'var(--text-tertiary)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    borderRadius: idx === 0 ? '6px 0 0 6px' : '0 6px 6px 0',
                    borderLeftWidth: idx === 0 ? 1 : 0,
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </Field>

        <button
          onClick={p.onSearch}
          disabled={p.loading}
          style={{
            height: 34,
            padding: '0 20px',
            borderRadius: 6,
            border: '1px solid var(--action)',
            background: p.loading ? 'var(--action-muted)' : 'var(--action)',
            color: p.loading ? 'var(--text-tertiary)' : 'var(--text-on-primary)',
            fontSize: 13,
            fontWeight: 600,
            cursor: p.loading ? 'default' : 'pointer',
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
          }}
        >
          {p.loading ? '조회 중...' : '조회'}
        </button>
      </div>
    </Section>
  );
}

function Field({
  label,
  minWidth,
  children,
}: {
  label: string;
  minWidth: number;
  children: React.ReactNode;
}) {
  return (
    <div style={{ flex: `1 1 ${minWidth}px`, minWidth }}>
      <label style={fieldLabel}>{label}</label>
      {children}
    </div>
  );
}
