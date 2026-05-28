"use client";

import type { DocSettings, QuoteColumnConfig, QuoteColumnKey, WarehouseTab } from "../types";
import type { useQuoteItems } from "../hooks/useQuoteItems";
import type { useQuoteExports } from "../hooks/useQuoteExports";
import type { useInventoryLayout } from "../hooks/useInventoryLayout";
import { FloatingCartButton } from "./FloatingCartButton";
import { MobileQuotePanel } from "./MobileQuotePanel";
import { QuoteBottomSheet } from "./QuoteBottomSheet";

type Props = {
  activeTab: WarehouseTab;
  layout: ReturnType<typeof useInventoryLayout>;
  quote: ReturnType<typeof useQuoteItems>;
  exports: ReturnType<typeof useQuoteExports>;

  totalQty: number;
  totalNormal: number;
  totalDiscount: number;

  showDocSettings: boolean;
  setShowDocSettings: (v: boolean) => void;
  docSettings: DocSettings;
  setDocSettings: (d: DocSettings) => void;

  showQuoteColumnSettings: boolean;
  setShowQuoteColumnSettings: (v: boolean) => void;
  visibleQuoteColumns: QuoteColumnKey[];
  setVisibleQuoteColumns: React.Dispatch<React.SetStateAction<QuoteColumnKey[]>>;
  visibleQuoteCols: QuoteColumnConfig[];
};

/** 모바일 전용 오버레이들: 플로팅 카트 + 견적 패널 + 바텀시트 */
export function MobileOverlays(p: Props) {
  return (
    <>
      {p.layout.isMobile && (
        <FloatingCartButton
          onClick={() => p.layout.setShowQuotePanel(true)}
          itemCount={p.quote.quoteItems.length}
        />
      )}

      {p.layout.isMobile && p.layout.showQuotePanel && (
        <MobileQuotePanel
          activeTab={p.activeTab}
          quoteItems={p.quote.quoteItems}
          totalQty={p.totalQty}
          totalNormal={p.totalNormal}
          totalDiscount={p.totalDiscount}
          clientName={p.quote.clientName}
          setClientName={p.quote.setClientName}
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
          onClose={() => p.layout.setShowQuotePanel(false)}
          onMoveItem={p.quote.moveItem}
          onDeleteItem={p.quote.deleteQuoteItem}
          onOpenBottomSheet={p.quote.openBottomSheet}
          onClearAll={p.quote.clearAllQuote}
          exporting={p.exports.exporting}
          exportingNotes={p.exports.exportingNotes}
          onExport={p.exports.handleExport}
          noteMenuOpen={p.exports.noteMenuOpen}
          setNoteMenuOpen={p.exports.setNoteMenuOpen}
          onDownloadNotes={(f) => {
            p.exports.setNoteMenuOpen(false);
            p.exports.handleTastingNotesDownload(f);
          }}
        />
      )}

      {p.quote.bottomSheetItem && (
        <QuoteBottomSheet
          item={p.quote.bottomSheetItem}
          values={p.quote.sheetValues as any}
          setValues={(updater) => p.quote.setSheetValues(updater as any)}
          onClose={() => p.quote.closeBottomSheet()}
          onSave={p.quote.saveBottomSheet}
        />
      )}
    </>
  );
}
