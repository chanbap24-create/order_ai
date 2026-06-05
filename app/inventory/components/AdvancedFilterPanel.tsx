"use client";

import { ITEM_CATEGORY_MAP } from "../constants/categories";
import { EMPTY_ADVANCED_FILTERS } from "../types";
import type { AdvancedFilters, RangeFilter, SelectFilter } from "../types";

type Props = {
  filters: AdvancedFilters;
  setFilters: (updater: (f: AdvancedFilters) => AdvancedFilters) => void;
  activeCount: number;
  countryList: string[];
  onApply: () => void;
  onClose: () => void;
};

const rangeFields: Array<{ key: keyof AdvancedFilters; label: string; width: number }> = [
  { key: "stock", label: "재고+보세", width: 65 },
  { key: "sales30", label: "30일 출고", width: 65 },
  { key: "sales90", label: "90일 출고", width: 65 },
  { key: "vintage", label: "빈티지", width: 65 },
  { key: "supplyPrice", label: "공급가", width: 80 },
  { key: "retailPrice", label: "소비자가", width: 80 },
  { key: "minPrice", label: "최저판매가", width: 80 },
];

/** 9개 범위 필터 + 분류/국가 selects + 적용/초기화 */
export function AdvancedFilterPanel({
  filters,
  setFilters,
  activeCount,
  countryList,
  onApply,
  onClose,
}: Props) {
  return (
    <div
      style={{
        marginBottom: 12,
        padding: "14px 16px",
        background: "white",
        borderRadius: 12,
        border: "1px solid var(--gray-100)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#2D2D2D" }}>조건 필터</span>
        {activeCount > 0 && (
          <span style={{ fontSize: "0.68rem", color: "var(--action)", fontWeight: 500 }}>
            {activeCount}개 활성
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rangeFields.map(({ key, label, width }) => {
          const r = filters[key] as RangeFilter;
          return (
            <RangeRow
              key={key}
              label={label}
              inputWidth={width}
              value={r}
              onChange={(next) => setFilters((f) => ({ ...f, [key]: next }))}
            />
          );
        })}

        <SelectRow
          label="분류"
          value={filters.category}
          onChange={(v) => setFilters((f) => ({ ...f, category: v }))}
          options={Object.values(ITEM_CATEGORY_MAP)}
          width={150}
        />

        <SelectRow
          label="국가"
          value={filters.country}
          onChange={(v) => setFilters((f) => ({ ...f, country: v }))}
          options={countryList}
          width={150}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
        <button
          onClick={() => setFilters(() => EMPTY_ADVANCED_FILTERS)}
          style={{
            padding: "6px 16px",
            borderRadius: 6,
            border: "1px solid var(--gray-200)",
            background: "white",
            color: "#888",
            fontSize: "0.75rem",
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          초기화
        </button>
        <button
          onClick={() => {
            onClose();
            onApply();
          }}
          style={{
            padding: "6px 16px",
            borderRadius: 6,
            border: "none",
            background: "var(--action)",
            color: "white",
            fontSize: "0.75rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          검색
        </button>
      </div>
    </div>
  );
}

function RangeRow({
  label,
  inputWidth,
  value,
  onChange,
}: {
  label: string;
  inputWidth: number;
  value: RangeFilter;
  onChange: (next: RangeFilter) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          minWidth: 80,
          fontSize: "0.75rem",
          color: "#555",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
          style={{ accentColor: "var(--action)" }}
        />
        {label}
      </label>
      <NumberInput
        value={value.min}
        placeholder="최소"
        enabled={value.enabled}
        width={inputWidth}
        onChange={(v) => onChange({ ...value, min: v })}
      />
      <span style={{ fontSize: "0.7rem", color: "var(--gray-400)" }}>~</span>
      <NumberInput
        value={value.max}
        placeholder="최대"
        enabled={value.enabled}
        width={inputWidth}
        onChange={(v) => onChange({ ...value, max: v })}
      />
    </div>
  );
}

function NumberInput({
  value,
  placeholder,
  enabled,
  width,
  onChange,
}: {
  value: string;
  placeholder: string;
  enabled: boolean;
  width: number;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="number"
      value={value}
      placeholder={placeholder}
      disabled={!enabled}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width,
        height: 30,
        borderRadius: 6,
        border: "1px solid var(--gray-200)",
        padding: "0 6px",
        fontSize: 16,
        textAlign: "right",
        opacity: enabled ? 1 : 0.4,
      }}
    />
  );
}

function SelectRow({
  label,
  value,
  onChange,
  options,
  width,
}: {
  label: string;
  value: SelectFilter;
  onChange: (next: SelectFilter) => void;
  options: string[];
  width: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          minWidth: 80,
          fontSize: "0.75rem",
          color: "#555",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={value?.enabled || false}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
          style={{ accentColor: "var(--action)" }}
        />
        {label}
      </label>
      <select
        value={value?.value || ""}
        disabled={!value?.enabled}
        onChange={(e) => onChange({ ...value, value: e.target.value })}
        style={{
          width,
          height: 30,
          borderRadius: 6,
          border: "1px solid var(--gray-200)",
          padding: "0 6px",
          fontSize: 14,
          color: "#333",
          opacity: value?.enabled ? 1 : 0.4,
        }}
      >
        <option value="">전체</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
