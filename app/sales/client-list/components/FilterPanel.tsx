'use client';

import type { ListType } from '../types';
import { Section } from '@/app/components/ui';
import { inputStyle, selectStyle, labelStyle } from '@/app/styles/controls';

type Props = {
  isAdmin: boolean;
  managerList: string[];
  managerFilter: string;
  onManagerChange: (v: string) => void;
  type: ListType;
  onTypeChange: (t: ListType) => void;
  preset: string;
  onPresetChange: (v: string) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  businessType: string;
  onBusinessTypeChange: (v: string) => void;
  businessTypes: string[];
};

export function FilterPanel(p: Props) {
  return (
    <Section padding="md">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
          alignItems: 'end',
        }}
      >
        <Field label="구분">
          <SegmentedToggle
            value={p.type}
            options={[
              { value: 'wine', label: '까브드뱅' },
              { value: 'glass', label: '대유라이프' },
            ]}
            onChange={(v) => p.onTypeChange(v as ListType)}
          />
        </Field>

        {p.isAdmin && p.managerList.length > 0 && (
          <Field label="담당자">
            <select
              value={p.managerFilter}
              onChange={(e) => p.onManagerChange(e.target.value)}
              style={selectStyle}
            >
              {p.managerList.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="기간">
          <select
            value={p.preset}
            onChange={(e) => p.onPresetChange(e.target.value)}
            style={selectStyle}
          >
            <option value="thisMonth">이번 달</option>
            <option value="lastMonth">지난 달</option>
            <option value="last3Months">최근 3개월</option>
            <option value="thisYear">올해</option>
            <option value="lastYear">작년</option>
            <option value="custom">직접 입력</option>
          </select>
        </Field>

        {p.preset === 'custom' && (
          <>
            <Field label="시작일">
              <input
                type="date"
                value={p.startDate}
                onChange={(e) => p.onStartDateChange(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="종료일">
              <input
                type="date"
                value={p.endDate}
                onChange={(e) => p.onEndDateChange(e.target.value)}
                style={inputStyle}
              />
            </Field>
          </>
        )}

        <Field label="업종">
          <select
            value={p.businessType}
            onChange={(e) => p.onBusinessTypeChange(e.target.value)}
            style={selectStyle}
          >
            <option value="">전체 업종</option>
            {p.businessTypes.map((bt) => (
              <option key={bt} value={bt}>
                {bt}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function SegmentedToggle({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', height: 34 }}>
      {options.map((o, idx) => {
        const isActive = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
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
  );
}
