"use client";

import type { InvColumnConfig, InvColumnKey, InventoryItem, WarehouseTab } from "../types";
import { useLongPress } from "../lib/longPress";

type Props = {
  item: InventoryItem;
  activeTab: WarehouseTab;
  visibleColumns: InvColumnKey[];
  availableColumns: InvColumnConfig[];
  tastingNoteAvailable: boolean;
  importSchedule?: any[];
  importPopupOpen: boolean;
  addedHighlight: boolean;
  onTastingNoteClick: (itemNo: string, itemName: string) => void;
  onToggleImportPopup: (itemNo: string | null) => void;
  onAddToQuote: (item: InventoryItem) => void;
  onLongPress?: (itemNo: string, itemName: string) => void;
  renderCellValue: (item: InventoryItem, colKey: InvColumnKey) => React.ReactNode;
};

export function ItemCard({
  item,
  activeTab,
  visibleColumns,
  availableColumns,
  tastingNoteAvailable,
  importSchedule,
  importPopupOpen,
  addedHighlight,
  onTastingNoteClick,
  onToggleImportPopup,
  onAddToQuote,
  onLongPress,
  renderCellValue,
}: Props) {
  const longPressHandlers = useLongPress(
    () => onLongPress?.(item.item_no, item.item_name),
    { delay: 500 },
  );
  return (
    <div
      className="inv-card"
      {...(onLongPress ? longPressHandlers : {})}
      style={{
        padding: "12px 14px 12px 16px",
        background: "white",
        borderRadius: 10,
        border: "1px solid var(--gray-100)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        cursor: "default",
        // 텍스트 복사 가능. long-press 는 longPress.ts 가 5px 이상 이동 시 자동 취소하므로
        // 사용자가 텍스트 선택을 위해 드래그하면 popup 안 뜨고, 가만히 누르고 있으면 popup.
        WebkitTouchCallout: onLongPress ? "none" : undefined, // iOS 컨텍스트 메뉴만 차단
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flex: 1, minWidth: 0 }}>
          {activeTab === "CDV" ? (
            <button
              onClick={() => onTastingNoteClick(item.item_no, item.item_name)}
              style={{
                fontSize: "0.72rem", fontFamily: "monospace", fontWeight: 600,
                color: tastingNoteAvailable ? "var(--color-success)" : "var(--gray-300)",
                background: "none", border: "none", cursor: "pointer", padding: 0,
                textDecoration: tastingNoteAvailable ? "underline" : "none",
                flexShrink: 0,
              }}
            >
              {item.item_no}
            </button>
          ) : (
            <span
              style={{
                fontSize: "0.72rem", fontFamily: "monospace", fontWeight: 600,
                color: "var(--gray-300)", flexShrink: 0,
              }}
            >
              {item.item_no}
            </span>
          )}
          <span
            style={{
              fontSize: "0.84rem", fontWeight: 700, color: "#1a1a2e",
              lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis",
            }}
          >
            {item.item_name}
          </span>
          {(item as any).item_name_en && (
            <span
              style={{
                fontSize: "0.68rem", color: "var(--neutral-100)", fontWeight: 400,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                flexShrink: 1,
              }}
            >
              {(item as any).item_name_en}
            </span>
          )}
          {importSchedule && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleImportPopup(importPopupOpen ? null : item.item_no);
              }}
              style={{
                background: "var(--status-warning)", color: "#fff", border: "none", borderRadius: 4,
                fontSize: "0.62rem", fontWeight: 700, padding: "2px 6px",
                cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap", lineHeight: 1.2,
              }}
            >
              입항 {importSchedule[0].arrival_date.slice(5)}
            </button>
          )}
        </div>
        <button
          className={`add-btn${addedHighlight ? " added" : ""}`}
          onClick={() => onAddToQuote(item)}
        >
          {addedHighlight ? "✓" : "+"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 6,
        }}
      >
        {visibleColumns
          .filter((k) => k !== "item_no" && k !== "item_name")
          .map((colKey) => {
            const col = availableColumns.find((c) => c.key === colKey);
            if (!col) return null;
            return (
              <span
                key={`${item.item_no}-${colKey}`}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
                  padding: "3px 8px", borderRadius: 6, background: "#F7F6F4",
                  fontSize: "0.72rem", lineHeight: 1,
                }}
              >
                <span style={{ color: "var(--neutral-100)", fontWeight: 500, whiteSpace: "nowrap" }}>{col.label}</span>
                <span
                  style={{
                    color: "var(--neutral-700)", fontWeight: 600,
                    fontVariantNumeric: "tabular-nums", textAlign: "right", whiteSpace: "nowrap",
                  }}
                >
                  {renderCellValue(item, colKey)}
                </span>
              </span>
            );
          })}
      </div>

      {importPopupOpen && importSchedule && (
        <div
          style={{
            marginTop: 8, padding: "10px 12px", background: "var(--status-warning-bg)",
            borderRadius: 8, border: "1px solid rgba(230,81,0,0.2)",
          }}
        >
          <div
            style={{
              fontSize: "0.72rem", fontWeight: 700, color: "var(--status-warning)", marginBottom: 6,
            }}
          >
            수입일정
          </div>
          {importSchedule.map((s, si) => (
            <div
              key={si}
              style={{
                display: "flex", gap: 12, fontSize: "0.72rem",
                color: "#4E342E", marginBottom: 3,
              }}
            >
              <span style={{ fontWeight: 600 }}>{s.arrival_date}</span>
              <span>{s.total_btls.toLocaleString()}btls</span>
              <span style={{ color: "var(--text-tertiary)" }}>{s.bl_number}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
