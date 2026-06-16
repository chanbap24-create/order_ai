'use client';

import { useState } from 'react';
import type { DocSettings, QuoteColumnKey, QuoteColumnConfig, QuoteItem } from '@/app/inventory/types';
import { QUOTE_COLUMNS, DEFAULT_QUOTE_VISIBLE } from '@/app/inventory/constants/columns';
import { CDV_DOC_DEFAULTS } from '@/app/inventory/constants/docDefaults';
import { calcDiscountedPrice } from '@/app/inventory/lib/priceCalc';
import {
  getQuoteCellValue as getQuoteCellValueLib,
  formatQuoteCellValue as formatQuoteCellValueLib,
} from '@/app/inventory/lib/renderCell';
import type { useQuoteItems } from '@/app/inventory/hooks/useQuoteItems';
import { useQuoteInlineEdit } from '@/app/inventory/hooks/useQuoteInlineEdit';
import { useQuoteExports } from '@/app/inventory/hooks/useQuoteExports';
import { useTastingNoteModal } from '@/app/inventory/hooks/useTastingNoteModal';
import { DesktopSidebarContainer } from '@/app/inventory/components/DesktopSidebarContainer';
import { TastingNoteModal } from '@/app/inventory/components/TastingNoteModal';

type Props = {
  quote: ReturnType<typeof useQuoteItems>;
  getManagerParam: () => string;
};

/**
 * 추천견적 하단 견적 편집 패널 — /inventory 의 견적 빌더(DesktopSidebarContainer)를 그대로 재사용.
 * 할인률·수량 인라인 편집, 컬럼 표시/순서, 문서설정, 엑셀/테이스팅노트 발행까지 동일 기능.
 */
export function RecommendQuoteEditPanel({ quote, getManagerParam }: Props) {
  const [visibleQuoteColumns, setVisibleQuoteColumns] = useState<QuoteColumnKey[]>(DEFAULT_QUOTE_VISIBLE);
  const [docSettings, setDocSettings] = useState<DocSettings>(CDV_DOC_DEFAULTS);
  const [showDocSettings, setShowDocSettings] = useState(false);
  const [showQuoteColumnSettings, setShowQuoteColumnSettings] = useState(false);
  const [clientNameFocused, setClientNameFocused] = useState(false);

  const inlineEdit = useQuoteInlineEdit({ quoteItems: quote.quoteItems, updateQuoteItem: quote.updateQuoteItem });
  const tastingModal = useTastingNoteModal();
  const exports = useQuoteExports({
    clientName: quote.clientName,
    activeTab: 'CDV',
    visibleQuoteColumns,
    docSettings,
    getManagerParam,
    flushPendingEdit: inlineEdit.commitEdit,
  });

  const items = quote.quoteItems;
  const totalNormal = items.reduce((s, i) => s + i.supply_price * i.quantity, 0);
  const totalDiscount = items.reduce((s, i) => s + calcDiscountedPrice(i.supply_price, i.discount_rate, i.discounted_price) * i.quantity, 0);
  const totalRetailNormal = items.reduce((s, i) => s + (i.retail_price || 0) * i.quantity, 0);
  const totalRetailDiscount = items.reduce((s, i) => s + calcDiscountedPrice(i.retail_price || 0, i.discount_rate) * i.quantity, 0);
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  const visibleQuoteCols = visibleQuoteColumns
    .map((k) => QUOTE_COLUMNS.find((c) => c.key === k))
    .filter(Boolean) as QuoteColumnConfig[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getQuoteCellValue = (item: QuoteItem, key: string): any =>
    getQuoteCellValueLib(item, key as QuoteColumnKey, quote.wineProfiles);
  const formatQuoteCellValue = (item: QuoteItem, col: QuoteColumnConfig): string =>
    formatQuoteCellValueLib(item, col, quote.wineProfiles);

  const btn: React.CSSProperties = {
    padding: '7px 14px', borderRadius: 8, border: '1px solid var(--action-muted)',
    background: '#fff', color: 'var(--action)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  };

  if (items.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '28px 20px', color: 'var(--text-muted)', fontSize: 13,
        border: '1px dashed var(--action-muted)', borderRadius: 10,
      }}>
        추천에서 와인을 선택하고 <b>“견적에 담기”</b>를 누르면, 여기서 할인률·수량·컬럼을 바로 편집하고 견적서를 발행할 수 있습니다.
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <button onClick={exports.handleExport} disabled={exports.exporting}
          style={{ ...btn, background: 'var(--action)', color: '#fff', borderColor: 'var(--action)', opacity: exports.exporting ? 0.6 : 1 }}>
          {exports.exporting ? '생성 중…' : '엑셀 견적서 생성'}
        </button>
        <div style={{ position: 'relative' }}>
          <button onClick={() => exports.setNoteMenuOpen(!exports.noteMenuOpen)} disabled={exports.exportingNotes} style={btn}>
            {exports.exportingNotes ? '발행 중…' : '테이스팅노트 발행 ▾'}
          </button>
          {exports.noteMenuOpen && (
            <div style={{
              position: 'absolute', right: 0, top: '110%', background: '#fff',
              border: '1px solid var(--border-default)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50,
            }}>
              {(['pdf', 'pptx'] as const).map((f) => (
                <button key={f} onClick={() => { exports.setNoteMenuOpen(false); exports.handleTastingNotesDownload(f); }}
                  style={{ display: 'block', width: '100%', padding: '8px 16px', border: 'none', background: '#fff', textAlign: 'left', cursor: 'pointer', fontSize: 13 }}>
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <DesktopSidebarContainer
        activeTab="CDV"
        quote={quote}
        inlineEdit={inlineEdit}
        tastingModal={tastingModal}
        totalQty={totalQty}
        totalNormal={totalNormal}
        totalDiscount={totalDiscount}
        totalRetailNormal={totalRetailNormal}
        totalRetailDiscount={totalRetailDiscount}
        clientNameFocused={clientNameFocused}
        setClientNameFocused={setClientNameFocused}
        showDocSettings={showDocSettings}
        setShowDocSettings={setShowDocSettings}
        docSettings={docSettings}
        setDocSettings={setDocSettings}
        showQuoteColumnSettings={showQuoteColumnSettings}
        setShowQuoteColumnSettings={setShowQuoteColumnSettings}
        visibleQuoteColumns={visibleQuoteColumns}
        setVisibleQuoteColumns={setVisibleQuoteColumns}
        visibleQuoteCols={visibleQuoteCols}
        getQuoteCellValue={getQuoteCellValue}
        formatQuoteCellValue={formatQuoteCellValue}
      />

      <TastingNoteModal
        open={tastingModal.showTastingNote}
        onClose={tastingModal.close}
        selectedItemNo={tastingModal.selectedItemNo}
        selectedWineName={tastingModal.selectedWineName}
        loading={tastingModal.tastingNoteLoading}
        source={tastingModal.tastingNoteSource}
        pdfUrl={tastingModal.tastingNoteUrl}
        originalPdfUrl={tastingModal.originalPdfUrl}
        dbTastingNote={tastingModal.dbTastingNote}
        dbWineInfo={tastingModal.dbWineInfo}
        onDownload={tastingModal.download}
      />
    </div>
  );
}
