"use client";

import { GLASS_COLORS } from "../constants";

export type SuggestionRowProps = {
  itemIndex: number;
  suggestion: any;
  itemKey: string;
  /** 이 아이템 전체가 저장 중인지 */
  saving: boolean;
  /** 이 아이템 전체가 방금 저장되었는지 */
  saved: boolean;
  /** 신규 or 미입고 품목인가 (가격 입력 UI 필요) */
  needsPriceInput: boolean;
  priceInput: string;
  onPriceInputChange: (next: string) => void;
  discount?: number;
  onDiscountChange: (percent: number) => void;
  onApply: () => void | Promise<void>;
};

const DISCOUNT_PRESETS = [10, 15, 20, 25, 30];

/**
 * 단일 후보(suggestion) 한 줄을 렌더.
 * - 배지(신규/입고이력/미입고) + 공급가 + 가격·할인 입력 + 적용 버튼
 */
export function SuggestionRow({
  suggestion: s,
  itemKey,
  saving,
  saved,
  needsPriceInput,
  priceInput,
  onPriceInputChange,
  discount,
  onDiscountChange,
  onApply,
}: SuggestionRowProps) {
  const isNewItem = !!s.is_new_item;
  const inClientHistory = !!s.in_client_history;
  const displayName = s.item_name?.split(" / ")[0] || s.item_name;

  return (
    <div
      style={{
        marginBottom: 6,
        padding: "8px",
        background: saving
          ? "var(--gray-100)"
          : saved
            ? "rgba(16,185,129,0.06)"
            : GLASS_COLORS.surface,
        borderRadius: 6,
        border: `1px solid ${GLASS_COLORS.primaryBorder}`,
      }}
    >
      {/* 품목명 + 배지 + 점수 */}
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
          {isNewItem && <Badge bg={GLASS_COLORS.primary} label="신규" />}
          {!isNewItem && inClientHistory && <Badge bg={GLASS_COLORS.success} label="입고이력" />}
          {!isNewItem && !inClientHistory && <Badge bg="#e8a820" label="미입고" />}
        </div>
        <span style={{ fontSize: 10, color: "#888", marginLeft: 8 }}>
          {Number(s.score || 0).toFixed(3)}
        </span>
      </div>

      {s.supply_price && (
        <div
          style={{ marginBottom: 6, fontSize: 11, color: GLASS_COLORS.success, fontWeight: 600 }}
        >
          공급가: {Number(s.supply_price).toLocaleString()}원
        </div>
      )}

      {needsPriceInput && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: "0 0 auto", fontSize: 10, color: "#666" }}>공급가</div>
            <input
              type="number"
              placeholder="25000"
              value={priceInput || s.supply_price || ""}
              onChange={(e) => onPriceInputChange(e.target.value)}
              style={{
                flex: "0 0 120px",
                padding: "4px 8px",
                border: `1px solid ${GLASS_COLORS.dividerCardLight}`,
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
        disabled={saving}
        onClick={onApply}
        style={{
          width: "100%",
          padding: "6px 12px",
          borderRadius: 6,
          border: "none",
          background: saved ? GLASS_COLORS.success : GLASS_COLORS.primary,
          color: "white",
          cursor: saving ? "not-allowed" : "pointer",
          fontSize: 12,
          fontWeight: 600,
          opacity: saving ? 0.5 : 1,
        }}
      >
        {saving ? "처리중..." : saved ? "적용됨 ✅" : "적용"}
      </button>
    </div>
  );
}

function Badge({ bg, label }: { bg: string; label: string }) {
  return (
    <span
      style={{
        marginLeft: 6,
        padding: "1px 4px",
        background: bg,
        color: "white",
        fontSize: 10,
        borderRadius: 3,
        fontWeight: 600,
      }}
    >
      {label}
    </span>
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
    border: `1px solid ${active ? GLASS_COLORS.primary : "var(--gray-300)"}`,
    borderRadius: 4,
    background: active ? GLASS_COLORS.primaryBgHover : "white",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: active ? 600 : 400,
    color: active ? GLASS_COLORS.primary : "#666",
  };
}
