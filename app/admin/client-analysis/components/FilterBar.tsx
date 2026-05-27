'use client';

import type { Filters, FilterState } from '../types';
import { Section } from '@/app/components/ui';
import {
  inputStyle,
  selectStyle,
  labelStyle,
  btnSecondary,
} from '@/app/styles/controls';
import { PRESETS, matchPreset } from '@/app/lib/dateRangePresets';

type Props = {
  filters: Filters | null;
  filterLoading: boolean;
  state: FilterState;
  update: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  reset: () => void;
};

export function FilterBar({ filters, filterLoading, state, update, reset }: Props) {
  const activePreset = matchPreset({ startDate: state.startDate, endDate: state.endDate });
  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (p) {
      const r = p.fn();
      update('startDate', r.startDate);
      update('endDate', r.endDate);
    }
  };

  if (filterLoading) {
    return (
      <div style={{ marginBottom: 16 }}>
        <Section padding="sm">
          <div
            style={{
              textAlign: 'center',
              padding: 12,
              color: 'var(--text-tertiary)',
              fontSize: 12,
            }}
          >
            필터 로딩 중...
          </div>
        </Section>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <Section padding="sm">
        <div
          style={{
            display: 'flex',
            alignItems: 'end',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <Field label="담당자" minWidth={120}>
            <select
              style={selectStyle}
              value={state.manager}
              onChange={(e) => update('manager', e.target.value)}
            >
              <option value="">전체</option>
              {filters?.managers.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="부서" minWidth={120}>
            <select
              style={selectStyle}
              value={state.department}
              onChange={(e) => update('department', e.target.value)}
            >
              <option value="">전체</option>
              {filters?.departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="업종" minWidth={120}>
            <select
              style={selectStyle}
              value={state.businessType}
              onChange={(e) => update('businessType', e.target.value)}
            >
              <option value="">전체</option>
              {filters?.businessTypes.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </Field>
          <Field label="시작일" minWidth={140}>
            <input
              type="date"
              style={inputStyle}
              value={state.startDate}
              onChange={(e) => update('startDate', e.target.value)}
            />
          </Field>
          <Field label="종료일" minWidth={140}>
            <input
              type="date"
              style={inputStyle}
              value={state.endDate}
              onChange={(e) => update('endDate', e.target.value)}
            />
          </Field>
          <Field label="빠른 범위" minWidth={140}>
            <select
              style={selectStyle}
              value={activePreset ?? ''}
              onChange={(e) => applyPreset(e.target.value)}
            >
              <option value="">직접 입력</option>
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="거래처" minWidth={160} flex>
            <input
              type="text"
              style={inputStyle}
              placeholder="검색"
              value={state.clientSearch}
              onChange={(e) => update('clientSearch', e.target.value)}
            />
          </Field>
          <button onClick={reset} style={btnSecondary}>
            초기화
          </button>
        </div>
      </Section>
    </div>
  );
}

function Field({
  label,
  minWidth,
  flex,
  children,
}: {
  label: string;
  minWidth: number;
  flex?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        flex: flex ? `1 1 ${minWidth}px` : `0 1 ${minWidth}px`,
        minWidth,
      }}
    >
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}
