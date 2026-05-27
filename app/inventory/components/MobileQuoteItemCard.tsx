"use client";

import { formatPercent, formatWon } from "../lib/format";
import { calcDiscountedPrice } from "../lib/priceCalc";
import type { QuoteItem } from "../types";

type Props = {
  item: QuoteItem;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onOpen: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
};

/** 모바일 패널의 견적 항목 1개 카드 — 클릭 시 바텀시트 오픈, ▲▼× 버튼 */
export function MobileQuoteItemCard({
  item,
  index,
  isFirst,
  isLast,
  onOpen,
  onMoveUp,
  onMoveDown,
  onDelete,
}: Props) {
  const discounted = calcDiscountedPrice(
    item.supply_price,
    item.discount_rate,
    item.discounted_price,
  );
  const normalTotal = item.supply_price * item.quantity;
  const discountTotal = discounted * item.quantity;

  return (
    <div
      onClick={onOpen}
      style={{
        padding: 14,
        background: "#fafaf8",
        borderRadius: 10,
        border: "1px solid #F0EFED",
        cursor: "pointer",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 6,
          right: 8,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <MoveBtn onClick={onMoveUp} disabled={isFirst}>
          ▲
        </MoveBtn>
        <MoveBtn onClick={onMoveDown} disabled={isLast}>
          ▼
        </MoveBtn>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{
            background: "none",
            border: "none",
            color: "#ccc",
            fontSize: 18,
            cursor: "pointer",
            lineHeight: 1,
            padding: "0 2px",
          }}
        >
          ×
        </button>
      </div>
      <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>
        #{index + 1} {item.item_code}
        {item.vintage && ` · ${item.vintage}`}
        {item.country && ` · ${item.country}`}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, paddingRight: 24 }}>
        {item.korean_name || item.product_name}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: "#888" }}>공급가</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{formatWon(item.supply_price)}</div>
          </div>
          {item.discount_rate > 0 && (
            <div>
              <div style={{ fontSize: 11, color: "#888" }}>할인가</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--action)" }}>
                {formatWon(discounted)} ({formatPercent(item.discount_rate)})
              </div>
            </div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#888" }}>수량</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{item.quantity}</div>
        </div>
      </div>
      <div
        style={{
          marginTop: 8,
          paddingTop: 8,
          borderTop: "1px solid #eee",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
        }}
      >
        <span style={{ color: "#666" }}>정상 {formatWon(normalTotal)}원</span>
        <span style={{ color: "var(--action)", fontWeight: 600 }}>
          할인 {formatWon(discountTotal)}원
        </span>
      </div>
      {item.note && (
        <div style={{ marginTop: 4, fontSize: 12, color: "#888" }}>비고: {item.note}</div>
      )}
    </div>
  );
}

function MoveBtn({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick();
      }}
      disabled={disabled}
      style={{
        background: "none",
        border: "none",
        padding: "2px 4px",
        color: disabled ? "#ddd" : "#888",
        fontSize: 14,
        cursor: disabled ? "default" : "pointer",
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}
