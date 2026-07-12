"use client";

import { ORDER_COLORS } from "../constants";

type Props = {
  query: string;
  quantity: number;
  editingValue?: string;
  onEdit: (val: string) => void;
  onCommit: () => void;
  onDec: () => void;
  onInc: () => void;
  onRemove: () => void;
};

/** 수량 -/+ 버튼 + 직접 입력 + 행 삭제 */
export function QuantityEditor({
  query,
  quantity,
  editingValue,
  onEdit,
  onCommit,
  onDec,
  onInc,
  onRemove,
}: Props) {
  return (
    <div
      style={{
        padding: "8px 14px",
        background: ORDER_COLORS.surfaceBg,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span style={{ fontSize: 12, color: ORDER_COLORS.primary, fontWeight: 600 }}>
        &quot;{query}&quot;
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <StepButton onClick={onDec}>-</StepButton>
        <input
          type="text"
          inputMode="numeric"
          value={editingValue !== undefined ? editingValue : quantity}
          onChange={(e) => onEdit(e.target.value)}
          onBlur={onCommit}
          style={{
            width: 34,
            textAlign: "center",
            fontSize: 14,
            fontWeight: 700,
            border: "1px solid var(--border-default)",
            borderRadius: 6,
            padding: "3px 0",
            color: ORDER_COLORS.text,
            background: "#fff",
          }}
        />
        <StepButton onClick={onInc}>+</StepButton>
        <button
          onClick={onRemove}
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            border: "1px solid rgba(220,38,38,0.1)",
            background: "rgba(220,38,38,0.03)",
            cursor: "pointer",
            fontSize: 12,
            color: ORDER_COLORS.confNone,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginLeft: 4,
            transition: "all 0.15s ease",
          }}
        >
          x
        </button>
      </div>
    </div>
  );
}

function StepButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="order-qty-btn"
      style={{
        width: 26,
        height: 26,
        borderRadius: 6,
        border: "1px solid var(--border-default)",
        background: "#fff",
        cursor: "pointer",
        fontSize: 14,
        color: ORDER_COLORS.primary,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.15s ease",
      }}
    >
      {children}
    </button>
  );
}
