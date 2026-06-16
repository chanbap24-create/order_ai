"use client";

import type {
  DocSettings,
  QuoteColumnConfig,
  QuoteColumnKey,
  QuoteItem,
  WarehouseTab,
} from "../types";
import type { useQuoteItems } from "../hooks/useQuoteItems";
import type { useQuoteInlineEdit } from "../hooks/useQuoteInlineEdit";
import type { useTastingNoteModal } from "../hooks/useTastingNoteModal";
import { DesktopQuoteSidebar } from "./DesktopQuoteSidebar";

type Props = {
  activeTab: WarehouseTab;
  quote: ReturnType<typeof useQuoteItems>;
  inlineEdit: ReturnType<typeof useQuoteInlineEdit>;
  tastingModal: ReturnType<typeof useTastingNoteModal>;

  totalQty: number;
  totalNormal: number;
  totalDiscount: number;
  totalRetailNormal: number;
  totalRetailDiscount: number;

  clientNameFocused: boolean;
  setClientNameFocused: (v: boolean) => void;

  showDocSettings: boolean;
  setShowDocSettings: (v: boolean) => void;
  docSettings: DocSettings;
  setDocSettings: (d: DocSettings) => void;

  showQuoteColumnSettings: boolean;
  setShowQuoteColumnSettings: (v: boolean) => void;
  visibleQuoteColumns: QuoteColumnKey[];
  setVisibleQuoteColumns: React.Dispatch<React.SetStateAction<QuoteColumnKey[]>>;
  visibleQuoteCols: QuoteColumnConfig[];

  getQuoteCellValue: (item: QuoteItem, key: string) => any;
  formatQuoteCellValue: (item: QuoteItem, col: QuoteColumnConfig) => string;
  fullWidth?: boolean;
};

/** 데스크톱 견적 사이드바 wiring 래퍼 — page.tsx의 prop bloat 제거 */
export function DesktopSidebarContainer(p: Props) {
  return (
    <DesktopQuoteSidebar
      fullWidth={p.fullWidth}
      activeTab={p.activeTab}
      quoteItems={p.quote.quoteItems}
      quoteLoading={p.quote.quoteLoading}
      totalQty={p.totalQty}
      totalNormal={p.totalNormal}
      totalDiscount={p.totalDiscount}
      totalRetailNormal={p.totalRetailNormal}
      totalRetailDiscount={p.totalRetailDiscount}
      clientName={p.quote.clientName}
      setClientName={p.quote.setClientName}
      clientNameFocused={p.clientNameFocused}
      setClientNameFocused={p.setClientNameFocused}
      showDocSettings={p.showDocSettings}
      setShowDocSettings={p.setShowDocSettings}
      docSettings={p.docSettings}
      setDocSettings={p.setDocSettings}
      resetDocSettings={(defaults) => p.setDocSettings(defaults)}
      showQuoteColumnSettings={p.showQuoteColumnSettings}
      setShowQuoteColumnSettings={p.setShowQuoteColumnSettings}
      visibleQuoteColumns={p.visibleQuoteColumns}
      setVisibleQuoteColumns={p.setVisibleQuoteColumns}
      visibleQuoteCols={p.visibleQuoteCols}
      editCell={p.inlineEdit.editCell}
      editValue={p.inlineEdit.editValue}
      setEditCell={p.inlineEdit.setEditCell}
      setEditValue={p.inlineEdit.setEditValue}
      startEdit={p.inlineEdit.startEdit}
      commitEdit={p.inlineEdit.commitEdit}
      getQuoteCellValue={p.getQuoteCellValue}
      formatQuoteCellValue={p.formatQuoteCellValue}
      tastingNoteSet={p.tastingModal.tastingNoteSet}
      onReorderItemTo={p.quote.reorderItemTo}
      onDeleteItem={p.quote.deleteQuoteItem}
      onClearAll={p.quote.clearAllQuote}
      onReorderColumns={(updater) => {
        p.setVisibleQuoteColumns((prevKeys) => {
          const prevCols = prevKeys
            .map((k) => p.visibleQuoteCols.find((c) => c.key === k))
            .filter((c): c is NonNullable<typeof c> => !!c);
          const nextCols = updater(prevCols);
          return nextCols.map((c) => c.key);
        });
      }}
    />
  );
}
