"use client";

import { WINE_COLORS } from "../constants";
import type { Suggestion } from "../types";

export type SuggestionRowProps = {
  suggestion: Suggestion;
  itemKey: string;
  saving: boolean;
  saved: boolean;
  priceInput: string;
  onPriceInputChange: (next: string) => void;
  discount?: number;
  onDiscountChange: (percent: number) => void;
  onApply: () => void | Promise<void>;
};

const DISCOUNT_PRESETS = [10, 15, 20, 25, 30];

/**
 * 와인 후보 한 줄: 코드/이름/신규 배지 + 공급가/할인율 (신규 품목만) + 적용 버튼.
 * Glass와 달리 `is_new_item`일 때만 가격 입력 UI 노출.
 */
export function SuggestionRow({
  suggestion: s,
  itemKey,
  saving,
  saved,
  priceInput,
  onPriceInputChange,
  discount,
  onDiscountChange,
  onApply,
}: SuggestionRowProps) {
  const isNewItem = !!s.is_new_item;
  const displayName = s.item_name?.split(" / ")[0] || s.item_name;
  const disabled = saving || (isNewItem && !priceInput);

  return (
    <div
      style={{
        marginBottom: 6,
        padding: 8,
        background: saving
          ? "var(--gray-100)"
          : saved
            ? "rgba(16,185,129,0.06)"
            : WINE_COLORS.surface,
        borderRadius: 6,
        border: `1px solid ${WINE_COLORS.primaryBorder}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
          fontSize: 12,
        }}
      >
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          <b>{s.item_no}</b>
          <span style={{ color: "#333", marginLeft: 6 }}>{displayName}</span>
          {isNewItem && (
            <span
              style={{
                marginLeft: 6,
                padding: "1px 4px",
                background: WINE_COLORS.primary,
                color: "white",
                fontSize: 10,
                borderRadius: 3,
                fontWeight: 600,
              }}
            >
              신규
            </span>
          )}
        </div>
        <span style={{ fontSize: 10, color: "#888", marginLeft: 8 }}>
          {Number(s.score || 0).toFixed(3)}
        </span>
      </div>

      {s.supply_price && (
        <div style={{ marginBottom: 6, fontSize: 11, color: WINE_COLORS.success, fontWeight: 600 }}>
          공급가: {Number(s.supply_price).toLocaleString()}원
        </div>
      )}

      {isNewItem && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: "0 0 auto", fontSize: 10, color: "#666" }}>공급가</div>
            <input
              type="number"
              placeholder="240000"
              value={priceInput || s.supply_price || ""}
              onChange={(e) => onPriceInputChange(e.target.value)}
              style={{
                flex: "0 0 120px",
                padding: "4px 8px",
                border: `1px solid ${WINE_COLORS.dividerCardLight}`,
                borderRadius: 4,
                fontSize: 12,
              }}
            />
            {DISCOUNT_PRESETS.map((d) => (
              <DiscountButton
                key={d}
                percent={d}
                active={discount === d}
                onClick={() => onDiscountChange(d)}
              />
            ))}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const custom = prompt("할인율 입력 (%):", "0");
                if (custom && !isNaN(Number(custom))) onDiscountChange(Number(custom));
              }}
              style={discountButtonStyle(false)}
            >
              직접
            </button>
          </div>
        </div>
      )}

      <button
        disabled={disabled}
        onClick={onApply}
        style={{
          width: "100%",
          padding: "6px 12px",
          borderRadius: 6,
          border: "none",
          background: saved ? WINE_COLORS.success : WINE_COLORS.primary,
          color: "white",
          cursor: disabled ? "not-allowed" : "pointer",
          fontSize: 12,
          fontWeight: 600,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {saving ? "처리중..." : saved ? "적용됨 ✅" : "적용"}
      </button>
    </div>
  );
}

function DiscountButton({
  percent,
  active,
  onClick,
}: {
  percent: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={discountButtonStyle(active)}
    >
      {percent}%
    </button>
  );
}

function discountButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: "4px 8px",
    border: `1px solid ${active ? WINE_COLORS.primary : "var(--gray-300)"}`,
    borderRadius: 4,
    background: active ? WINE_COLORS.primaryBgHover : "white",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: active ? 600 : 400,
    color: active ? WINE_COLORS.primary : "#666",
  };
}
