"use client";

import { ORDER_COLORS } from "../constants";
import { fmt, parsePrice } from "../lib/format";
import type { Candidate } from "../types";

type Props = {
  lineIdx: number;
  selected: Candidate;
  discount: number;
  discountedPrice: number;
  // 공급가 입력
  editingPrice?: string;
  onEditPrice: (val: string) => void;
  onCommitPrice: () => void;
  // 할인율
  customDiscountInput?: string;
  onDiscountSelect: (nextValue: string) => void; // 'custom' | 'tasting' | '0'..'50'
  onCustomDiscountChange: (raw: string) => void;
  onCustomDiscountBlur: () => void;
};

const DISCOUNT_OPTIONS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

/** 공급가 편집 + 할인 select + (직접입력 시 %) + 시음주 배지 + 재고/입고 */
export function PriceDiscountEditor({
  selected,
  discount,
  discountedPrice,
  editingPrice,
  onEditPrice,
  onCommitPrice,
  customDiscountInput,
  onDiscountSelect,
  onCustomDiscountChange,
  onCustomDiscountBlur,
}: Props) {
  const selectValue =
    customDiscountInput !== undefined
      ? "custom"
      : discount === 100
        ? "tasting"
        : String(discount);

  return (
    <div
      style={{
        padding: "8px 14px 10px",
        borderTop: "1px solid rgba(90,21,21,0.04)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        background: ORDER_COLORS.surfaceBg,
      }}
    >
      {/* 공급가 */}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontSize: 11, color: ORDER_COLORS.textMuted, fontWeight: 500 }}>
          공급가
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={
            editingPrice !== undefined
              ? editingPrice
              : selected.supply_price.toLocaleString()
          }
          onChange={(e) => onEditPrice(e.target.value)}
          onBlur={onCommitPrice}
          style={{
            width: 78,
            textAlign: "right",
            fontSize: 12,
            fontWeight: 600,
            border:
              selected.supply_price === 0
                ? "1.5px solid var(--status-warning)"
                : "1px solid rgba(90,21,21,0.1)",
            borderRadius: 6,
            padding: "3px 6px",
            color: ORDER_COLORS.text,
            background: selected.supply_price === 0 ? "#fffbeb" : "#fff",
          }}
        />
      </div>

      {/* 할인 */}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontSize: 11, color: ORDER_COLORS.textMuted, fontWeight: 500 }}>할인</span>
        <select
          value={selectValue}
          onChange={(e) => onDiscountSelect(e.target.value)}
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "3px 4px",
            borderRadius: 6,
            border: "1px solid rgba(90,21,21,0.1)",
            background: "#fff",
            color: discount > 0 ? ORDER_COLORS.primary : ORDER_COLORS.textMuted,
            cursor: "pointer",
          }}
        >
          {DISCOUNT_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v}%
            </option>
          ))}
          <option value="custom">직접입력</option>
          <option value="tasting">🍷 시음주</option>
        </select>
        {customDiscountInput !== undefined && (
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            placeholder="%"
            value={customDiscountInput}
            onChange={(e) => onCustomDiscountChange(e.target.value.replace(/[^0-9]/g, ""))}
            onBlur={onCustomDiscountBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            style={{
              width: 44,
              textAlign: "center",
              fontSize: 12,
              fontWeight: 600,
              border: "1.5px solid var(--action)",
              borderRadius: 6,
              padding: "3px 4px",
              color: ORDER_COLORS.primary,
              background: "#fff",
            }}
          />
        )}
      </div>

      {discount === 100 && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#fff",
            background: ORDER_COLORS.primary,
            padding: "2px 8px",
            borderRadius: 10,
          }}
        >
          시음주
        </span>
      )}
      {discount > 0 && discount < 100 && (
        <span style={{ fontSize: 11, fontWeight: 700, color: ORDER_COLORS.primary }}>
          → {fmt(discountedPrice)}
        </span>
      )}

      <span
        style={{
          fontSize: 10,
          color: "#b8b0a8",
          marginLeft: "auto",
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        재고 {selected.available_stock}
        {selected.incoming && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: "#0369a1",
              background: "#e0f2fe",
              padding: "1px 6px",
              borderRadius: 4,
              border: "1px solid #bae6fd",
            }}
          >
            입고 {selected.incoming.arrival_date.slice(5)} · {selected.incoming.total_btls}병
          </span>
        )}
      </span>
    </div>
  );
}

/** 할인율 select value 변경을 상위 상태 변화로 해석해주는 헬퍼 */
export function resolveDiscountChange(v: string):
  | { type: "custom"; hint: number }
  | { type: "tasting" }
  | { type: "preset"; value: number } {
  if (v === "custom") return { type: "custom", hint: 0 };
  if (v === "tasting") return { type: "tasting" };
  return { type: "preset", value: Number(v) };
}

/** 공급가 blur 시 숫자 변환 도우미 */
export function commitPriceText(text: string | undefined): number | null {
  if (text === undefined) return null;
  const n = parsePrice(text);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
