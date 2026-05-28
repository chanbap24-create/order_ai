'use client';

import type { RefObject } from 'react';
import type { SearchItem, Warehouse } from '../types';
import { getQuickRanges } from '../lib/quickRanges';
import { ItemSearchInput } from './ItemSearchInput';
import { Section } from '@/app/components/ui';
import {
  inputStyle,
  selectStyle,
  labelStyle,
  btnPrimary,
  btnDisabled,
} from '@/app/styles/controls';

type Props = {
  warehouse: Warehouse;
  onWarehouseChange: (w: Warehouse) => void;
  searchRef: RefObject<HTMLDivElement | null>;
  itemSearch: string;
  onSearchChange: (v: string) => void;
  onSearchFocus: () => void;
  selectedItem: SearchItem | null;
  suggestions: SearchItem[];
  showSuggestions: boolean;
  onSelectItem: (s: SearchItem) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  loading: boolean;
  onSearch: () => void;
  error: string;
};

export function FilterCard(p: Props) {
  const presets = getQuickRanges();
  const activePreset =
    presets.find((r) => r.start === p.startDate && r.end === p.endDate)?.label ?? '';
  const applyPreset = (label: string) => {
    const r = presets.find((x) => x.label === label);
    if (r) {
      p.setStartDate(r.start);
      p.setEndDate(r.end);
    }
  };

  return (
    <Section padding="md" overflowVisible>
      {/* 상단: 타이틀 + 창고 segmented toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '0.01em',
          }}
        >
          품목별 판매현황
        </span>
        <SegmentedToggle
          value={p.warehouse}
          options={[
            { value: 'CDV', label: '까브드뱅' },
            { value: 'DL', label: '대유라이프' },
          ]}
          onChange={(v) => p.onWarehouseChange(v as Warehouse)}
        />
      </div>

      {/* 검색 + 날짜 + 조회 한 줄 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px', minWidth: 200 }}>
          <ItemSearchInput
            searchRef={p.searchRef}
            itemSearch={p.itemSearch}
            onSearchChange={p.onSearchChange}
            onFocus={p.onSearchFocus}
            selectedItem={p.selectedItem}
            suggestions={p.suggestions}
            showSuggestions={p.showSuggestions}
            onSelect={p.onSelectItem}
          />
        </div>
        <Field label="시작일">
          <input
            type="date"
            value={p.startDate}
            onChange={(e) => p.setStartDate(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="종료일">
          <input
            type="date"
            value={p.endDate}
            onChange={(e) => p.setEndDate(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="빠른 범위">
          <select
            value={activePreset}
            onChange={(e) => applyPreset(e.target.value)}
            style={selectStyle}
          >
            <option value="">직접 입력</option>
            {presets.map((r) => (
              <option key={r.label} value={r.label}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        <button
          onClick={p.onSearch}
          disabled={p.loading}
          style={p.loading ? btnDisabled(btnPrimary) : btnPrimary}
        >
          {p.loading ? '조회 중...' : '조회'}
        </button>
      </div>

      {p.error && (
        <div
          style={{
            marginTop: 12,
            padding: '8px 12px',
            background: 'rgba(220,38,38,0.04)',
            border: '1px solid rgba(220,38,38,0.18)',
            borderRadius: 6,
            fontSize: 12,
            color: '#dc2626',
          }}
        >
          {p.error}
        </div>
      )}
    </Section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: '0 1 150px', minWidth: 140 }}>
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
    <div style={{ display: 'flex', height: 28 }}>
      {options.map((o, idx) => {
        const isActive = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              minWidth: 90,
              padding: '0 14px',
              border: '1px solid var(--border-default)',
              background: isActive ? 'var(--action)' : 'var(--surface)',
              color: isActive ? 'var(--text-on-primary)' : 'var(--text-tertiary)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              borderRadius: idx === 0 ? '6px 0 0 6px' : '0 6px 6px 0',
              borderLeftWidth: idx === 0 ? 1 : 0,
              letterSpacing: '0.02em',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
