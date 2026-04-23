"use client";

import type { InvColumnConfig, InvColumnKey, InventoryItem, WarehouseTab } from "../types";

type Props = {
  items: InventoryItem[];
  allResultsCount: number;
  activeTab: WarehouseTab;
  visibleInvColumns: InvColumnKey[];
  availableInvColumns: InvColumnConfig[];
  tastingNotesAvailable: Record<string, boolean>;
  importScheduleMap: Record<string, any[]>;
  showImportPopup: string | null;
  addedItemNo: string | null;
  onTastingNoteClick: (itemNo: string, itemName: string) => void;
  onToggleImportPopup: (itemNo: string | null) => void;
  onAddToQuote: (item: InventoryItem) => void;
  renderCellValue: (item: InventoryItem, colKey: InvColumnKey) => React.ReactNode;
};

/** 재고 검색 결과 카드 그리드 (+ 수입일정 팝업 + 빈 결과 메시지) */
export function SearchResultsGrid({
  items,
  allResultsCount,
  activeTab,
  visibleInvColumns,
  availableInvColumns,
  tastingNotesAvailable,
  importScheduleMap,
  showImportPopup,
  addedItemNo,
  onTastingNoteClick,
  onToggleImportPopup,
  onAddToQuote,
  renderCellValue,
}: Props) {
  if (items.length === 0) {
    return (
      <div
        style={{
          padding: "48px 24px",
          textAlign: "center",
          background: "white",
          borderRadius: 12,
          border: "1px solid #F0EFED",
        }}
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#D0D0D0"
          strokeWidth="1.5"
          style={{ marginBottom: 12 }}
        >
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        </svg>
        <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#2D2D2D" }}>
          No results found
        </div>
        <div style={{ fontSize: "0.75rem", color: "#999", marginTop: 4 }}>
          {allResultsCount === 0 ? "Try a different search term" : "Adjust filters to see more items"}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item, index) => (
        <ItemCard
          key={`${item.item_no}-${index}`}
          item={item}
          activeTab={activeTab}
          visibleColumns={visibleInvColumns}
          availableColumns={availableInvColumns}
          tastingNoteAvailable={!!tastingNotesAvailable[item.item_no]}
          importSchedule={importScheduleMap[item.item_no]}
          importPopupOpen={showImportPopup === item.item_no}
          addedHighlight={addedItemNo === item.item_no}
          onTastingNoteClick={onTastingNoteClick}
          onToggleImportPopup={onToggleImportPopup}
          onAddToQuote={onAddToQuote}
          renderCellValue={renderCellValue}
        />
      ))}
    </div>
  );
}

function ItemCard({
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
  renderCellValue,
}: {
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
  renderCellValue: (item: InventoryItem, colKey: InvColumnKey) => React.ReactNode;
}) {
  return (
    <div
      className="inv-card"
      style={{
        padding: "12px 14px 12px 16px",
        background: "white",
        borderRadius: 10,
        border: "1px solid #F0EFED",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        cursor: "default",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div
          style={{ display: "flex", alignItems: "baseline", gap: 8, flex: 1, minWidth: 0 }}
        >
          {activeTab === "CDV" ? (
            <button
              onClick={() => onTastingNoteClick(item.item_no, item.item_name)}
              style={{
                fontSize: "0.72rem",
                fontFamily: "monospace",
                fontWeight: 600,
                color: tastingNoteAvailable ? "#10b981" : "#BCBCBC",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                textDecoration: tastingNoteAvailable ? "underline" : "none",
                flexShrink: 0,
              }}
            >
              {item.item_no}
            </button>
          ) : (
            <span
              style={{
                fontSize: "0.72rem",
                fontFamily: "monospace",
                fontWeight: 600,
                color: "#BCBCBC",
                flexShrink: 0,
              }}
            >
              {item.item_no}
            </span>
          )}
          <span
            style={{
              fontSize: "0.84rem",
              fontWeight: 700,
              color: "#1a1a2e",
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {item.item_name}
          </span>
          {(item as any).item_name_en && (
            <span
              style={{
                fontSize: "0.68rem",
                color: "#999",
                fontWeight: 400,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
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
                background: "#E65100",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                fontSize: "0.62rem",
                fontWeight: 700,
                padding: "2px 6px",
                cursor: "pointer",
                flexShrink: 0,
                whiteSpace: "nowrap",
                lineHeight: 1.2,
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

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {visibleColumns
          .filter((k) => k !== "item_no" && k !== "item_name")
          .map((colKey) => {
            const col = availableColumns.find((c) => c.key === colKey);
            if (!col) return null;
            return (
              <span
                key={`${item.item_no}-${colKey}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 8px",
                  borderRadius: 6,
                  background: "#F7F6F4",
                  fontSize: "0.72rem",
                  lineHeight: 1,
                }}
              >
                <span style={{ color: "#999", fontWeight: 500 }}>{col.label}</span>
                <span style={{ color: "#2D2D2D", fontWeight: 600 }}>
                  {renderCellValue(item, colKey)}
                </span>
              </span>
            );
          })}
      </div>

      {importPopupOpen && importSchedule && (
        <div
          style={{
            marginTop: 8,
            padding: "10px 12px",
            background: "#FFF3E0",
            borderRadius: 8,
            border: "1px solid rgba(230,81,0,0.2)",
          }}
        >
          <div
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              color: "#E65100",
              marginBottom: 6,
            }}
          >
            수입일정
          </div>
          {importSchedule.map((s, si) => (
            <div
              key={si}
              style={{
                display: "flex",
                gap: 12,
                fontSize: "0.72rem",
                color: "#4E342E",
                marginBottom: 3,
              }}
            >
              <span style={{ fontWeight: 600 }}>{s.arrival_date}</span>
              <span>{s.total_btls.toLocaleString()}btls</span>
              <span style={{ color: "#8a8580" }}>{s.bl_number}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
