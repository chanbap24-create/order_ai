"use client";

import { WINE_COLORS } from "../constants";

type Props = {
  clientName: string;
  items: any[];
  show: boolean;
  loading: boolean;
  onToggle: () => void;
  addingItem: any;
  addingQty: string;
  setAddingQty: (v: string) => void;
  onStartAdd: (item: any) => void;
  onConfirmAdd: () => void;
  onCancelAdd: () => void;
};

/** 거래처 품목 보기 — 품목 목록에서 수량 입력 후 발주 텍스트로 추가 */
export function ClientItemsPanel({
  clientName,
  items,
  show,
  loading,
  onToggle,
  addingItem,
  addingQty,
  setAddingQty,
  onStartAdd,
  onConfirmAdd,
  onCancelAdd,
}: Props) {
  return (
    <div style={{ marginTop: 16 }}>
      <button
        onClick={onToggle}
        disabled={loading}
        style={{
          width: "100%",
          padding: 12,
          background: WINE_COLORS.surfaceBgAlt,
          border: `1px solid ${WINE_COLORS.dividerCardLight}`,
          borderRadius: 12,
          cursor: loading ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <span>거래처 품목 보기 ({clientName})</span>
        <span>{loading ? "..." : show ? "▲" : "▼"}</span>
      </button>

      {show && items.length > 0 && (
        <div
          style={{
            marginTop: 8,
            padding: 16,
            background: WINE_COLORS.surfaceBgAlt,
            borderRadius: 12,
          }}
        >
          <div
            style={{
              maxHeight: 400,
              overflowY: "auto",
              background: WINE_COLORS.surface,
              borderRadius: 8,
              border: "1px solid #e5e7eb",
            }}
          >
            {items.map((item, idx) => (
              <Row
                key={idx}
                item={item}
                isLast={idx === items.length - 1}
                isAdding={addingItem?.item_no === item.item_no}
                addingQty={addingQty}
                setAddingQty={setAddingQty}
                onStartAdd={() => onStartAdd(item)}
                onConfirmAdd={onConfirmAdd}
                onCancelAdd={onCancelAdd}
              />
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280", textAlign: "center" }}>
            품목을 클릭하면 발주 목록에 추가됩니다 (총 {items.length}개)
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  item,
  isLast,
  isAdding,
  addingQty,
  setAddingQty,
  onStartAdd,
  onConfirmAdd,
  onCancelAdd,
}: {
  item: any;
  isLast: boolean;
  isAdding: boolean;
  addingQty: string;
  setAddingQty: (v: string) => void;
  onStartAdd: () => void;
  onConfirmAdd: () => void;
  onCancelAdd: () => void;
}) {
  return (
    <div
      style={{
        padding: "12px 16px",
        borderBottom: isLast ? "none" : "1px solid #f0f0f0",
        background: isAdding ? "#f0fdf4" : WINE_COLORS.surface,
      }}
    >
      {isAdding ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{item.item_name}</div>
          <input
            type="number"
            value={addingQty}
            onChange={(e) => setAddingQty(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onConfirmAdd();
            }}
            autoFocus
            style={{
              width: 60,
              padding: "6px 8px",
              borderRadius: 6,
              border: `1px solid ${WINE_COLORS.neutralBorder}`,
              fontSize: 16,
              textAlign: "center",
            }}
            min="1"
          />
          <button
            onClick={onConfirmAdd}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "none",
              background: WINE_COLORS.success,
              color: "white",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            추가
          </button>
          <button
            onClick={onCancelAdd}
            style={{
              padding: "6px 8px",
              borderRadius: 6,
              border: `1px solid ${WINE_COLORS.neutralBorder}`,
              background: "white",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            취소
          </button>
        </div>
      ) : (
        <div
          onClick={onStartAdd}
          style={{
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{item.item_name}</div>
            <div style={{ fontSize: 12, color: WINE_COLORS.neutralTextMuted, marginTop: 2 }}>
              품목코드: {item.item_no}
            </div>
          </div>
          <div style={{ fontSize: 20, color: WINE_COLORS.neutralIcon }}>+</div>
        </div>
      )}
    </div>
  );
}
