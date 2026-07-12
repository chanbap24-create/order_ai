"use client";

import type { InvColumnConfig, InvColumnKey, InventoryItem, WarehouseTab } from "../types";
import { ItemCard } from "./ItemCard";

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
  onLongPressItem?: (itemNo: string, itemName: string) => void;
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
  onLongPressItem,
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
          border: "1px solid var(--border-default)",
        }}
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--gray-300)"
          strokeWidth="1.5"
          style={{ marginBottom: 12 }}
        >
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        </svg>
        <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--neutral-700)" }}>
          No results found
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--neutral-100)", marginTop: 4 }}>
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
          onLongPress={onLongPressItem}
          renderCellValue={renderCellValue}
        />
      ))}
    </div>
  );
}
