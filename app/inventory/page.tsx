'use client';

import { useState, useCallback } from 'react';
import type { InventoryItem, QuoteItem, QuoteColumnConfig } from './types';
import { calcDiscountedPrice } from './lib/priceCalc';
import {
  renderInvCellValue as renderInvCellValueLib,
  getQuoteCellValue as getQuoteCellValueLib,
  formatQuoteCellValue as formatQuoteCellValueLib,
} from './lib/renderCell';
import { TastingNoteModal } from './components/TastingNoteModal';
import { PageStyles } from './components/PageStyles';
import { Header as InventoryHeader } from './components/Header';
import { InventorySearchPanel } from './components/InventorySearchPanel';
import { DesktopSidebarContainer } from './components/DesktopSidebarContainer';
import { MobileOverlays } from './components/MobileOverlays';
import { SavedQuotesPanel } from './components/SavedQuotesPanel';
import { ItemLedgerPopup } from './components/ItemLedgerPopup';
import { useItemLedgerPopup } from './hooks/useItemLedgerPopup';
import { useServerPreferences } from './hooks/useServerPreferences';
import { useInventoryPreferences } from './hooks/useInventoryPreferences';
import { useTabSwitch } from './hooks/useTabSwitch';
import { useImportSchedule } from './hooks/useImportSchedule';
import { useTastingNoteModal } from './hooks/useTastingNoteModal';
import { useQuoteManager } from './hooks/useQuoteManager';
import { useQuoteItems } from './hooks/useQuoteItems';
import { useQuoteInlineEdit } from './hooks/useQuoteInlineEdit';
import { useInventorySearch } from './hooks/useInventorySearch';
import { useInventoryLayout } from './hooks/useInventoryLayout';
import { useInventoryPageState } from './hooks/useInventoryPageState';
import { useQuoteExports } from './hooks/useQuoteExports';
import { PromoQuoteOverlay, type PromoQuoteItem } from '@/app/sales/recommend/components/PromoQuoteOverlay';

export default function InventoryPage() {
  const prefs = useServerPreferences();

  // ── 탭·컬럼·문서설정 + 국가 목록 (분리 훅) ──
  const {
    activeTab, setActiveTab, countryList,
    visibleColumnsCDV, setVisibleColumnsCDV,
    visibleColumnsDL, setVisibleColumnsDL,
    visibleQuoteColumns, setVisibleQuoteColumns,
    docSettings, setDocSettings,
    visibleInvColumns, availableInvColumns, visibleQuoteCols,
  } = useInventoryPageState();

  // ── 페이지에 남는 UI 토글 state ──
  const [showInvColumnSettings, setShowInvColumnSettings] = useState(false);
  const [showQuoteColumnSettings, setShowQuoteColumnSettings] = useState(false);
  const [showDocSettings, setShowDocSettings] = useState(false);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [clientNameFocused, setClientNameFocused] = useState(false);
  const [showSavedQuotes, setShowSavedQuotes] = useState(false);
  const [showPromoStyle, setShowPromoStyle] = useState(false);

  // ── 도메인 훅 ──
  const { quoteManager, getManagerParam } = useQuoteManager();
  const importSchedule = useImportSchedule();
  const tastingModal = useTastingNoteModal();
  const itemLedgerPopup = useItemLedgerPopup({ warehouse: activeTab });

  const quote = useQuoteItems({ quoteManager, getManagerParam });
  const layout = useInventoryLayout({ bottomSheetItem: quote.bottomSheetItem });

  const addToQuoteAndOpen = useCallback(
    async (inv: InventoryItem) => {
      await quote.addToQuote(inv);
      if (layout.isMobile) layout.setShowQuotePanel(true);
      else layout.setQuoteOpen(true);
    },
    [quote, layout],
  );

  const inlineEdit = useQuoteInlineEdit({
    quoteItems: quote.quoteItems,
    updateQuoteItem: quote.updateQuoteItem,
  });

  const search = useInventorySearch({
    activeTab,
    importScheduleMap: importSchedule.importScheduleMap,
    tastingNoteSet: tastingModal.tastingNoteSet,
    onCheckTastingNote: tastingModal.markAvailable,
  });

  const exports = useQuoteExports({
    clientName: quote.clientName,
    clientCode: quote.clientCode,
    activeTab,
    visibleQuoteColumns,
    docSettings,
    getManagerParam,
    quoteItems: quote.quoteItems,
    flushPendingEdit: inlineEdit.commitEdit,
  });

  const { switchTab, toggleInvColumn } = useTabSwitch({
    activeTab,
    setActiveTab,
    visibleColumnsCDV,
    visibleColumnsDL,
    setVisibleColumnsCDV,
    setVisibleColumnsDL,
    setVisibleQuoteColumns,
    setDocSettings,
    onTabSwitched: search.resetForTabSwitch,
  });

  useInventoryPreferences(
    prefs,
    { setActiveTab, setVisibleColumnsCDV, setVisibleColumnsDL, setVisibleQuoteColumns, setDocSettings },
    { activeTab, visibleColumnsCDV, visibleColumnsDL, visibleQuoteColumns, docSettings },
  );

  // ── 견적 합계 ──
  const totalNormal = quote.quoteItems.reduce((s, i) => s + i.supply_price * i.quantity, 0);
  const totalDiscount = quote.quoteItems.reduce(
    (s, i) => s + calcDiscountedPrice(i.supply_price, i.discount_rate, i.discounted_price) * i.quantity,
    0,
  );
  const totalRetailNormal = quote.quoteItems.reduce(
    (s, i) => s + (i.retail_price || 0) * i.quantity,
    0,
  );
  const totalRetailDiscount = quote.quoteItems.reduce(
    (s, i) => s + calcDiscountedPrice(i.retail_price || 0, i.discount_rate) * i.quantity,
    0,
  );
  const totalQty = quote.quoteItems.reduce((s, i) => s + i.quantity, 0);

  // renderCell wrappers (wineProfiles 주입)
  const getQuoteCellValue = (item: QuoteItem, key: string): any =>
    getQuoteCellValueLib(item, key as QuoteColumnKey, quote.wineProfiles);
  const formatQuoteCellValue = (item: QuoteItem, col: QuoteColumnConfig): string =>
    formatQuoteCellValueLib(item, col, quote.wineProfiles);

  // ══════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════

  return (
    <div style={{ minHeight: 'calc(100vh - 56px)', background: 'var(--surface-muted)', wordBreak: 'keep-all' as const }}>
      <PageStyles />

      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '24px 16px' }}>
        <InventoryHeader
          activeTab={activeTab}
          onSwitchTab={switchTab}
          showInvColumnSettings={showInvColumnSettings}
          onToggleInvColumnSettings={() => setShowInvColumnSettings(!showInvColumnSettings)}
          hasQuoteItems={quote.quoteItems.length > 0}
          exporting={exports.exporting}
          onExport={exports.handleExport}
          exportingNotes={exports.exportingNotes}
          noteMenuOpen={exports.noteMenuOpen}
          setNoteMenuOpen={exports.setNoteMenuOpen}
          onDownloadNotes={(format) => {
            exports.setNoteMenuOpen(false);
            exports.handleTastingNotesDownload(format);
          }}
          onPromoStyle={() => setShowPromoStyle(true)}
        />

        <div
          style={{
            display: layout.isMobile ? 'block' : 'flex',
            gap: layout.isMobile ? 0 : 24,
            alignItems: 'flex-start',
          }}
        >
          <div style={{ flex: 1, minWidth: 0, maxWidth: layout.isMobile ? 'none' : '50%' }}>
            <InventorySearchPanel
              activeTab={activeTab}
              showInvColumnSettings={showInvColumnSettings}
              availableInvColumns={availableInvColumns}
              visibleInvColumns={visibleInvColumns}
              toggleInvColumn={toggleInvColumn}
              search={search}
              searchFocused={searchFocused}
              setSearchFocused={setSearchFocused}
              countryList={countryList}
              showAdvancedFilter={showAdvancedFilter}
              setShowAdvancedFilter={setShowAdvancedFilter}
              tastingModal={tastingModal}
              importSchedule={importSchedule}
              addedItemNo={quote.addedItemNo}
              onAddToQuote={addToQuoteAndOpen}
              onLongPressItem={itemLedgerPopup.openFor}
              renderCellValue={renderInvCellValueLib}
            />
          </div>

          {!layout.isMobile && (
            <DesktopSidebarContainer
              activeTab={activeTab}
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
              onOpenSaved={() => setShowSavedQuotes(true)}
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
          )}
        </div>

        <MobileOverlays
          activeTab={activeTab}
          layout={layout}
          quote={quote}
          exports={exports}
          onOpenSaved={() => setShowSavedQuotes(true)}
          totalQty={totalQty}
          totalNormal={totalNormal}
          totalDiscount={totalDiscount}
          showDocSettings={showDocSettings}
          setShowDocSettings={setShowDocSettings}
          docSettings={docSettings}
          setDocSettings={setDocSettings}
          showQuoteColumnSettings={showQuoteColumnSettings}
          setShowQuoteColumnSettings={setShowQuoteColumnSettings}
          visibleQuoteColumns={visibleQuoteColumns}
          setVisibleQuoteColumns={setVisibleQuoteColumns}
          visibleQuoteCols={visibleQuoteCols}
          onPromoStyle={() => { layout.setShowQuotePanel(false); setShowPromoStyle(true); }}
        />
      </div>

      <SavedQuotesPanel
        open={showSavedQuotes}
        onClose={() => setShowSavedQuotes(false)}
        getManagerParam={getManagerParam}
        hasDraftItems={quote.quoteItems.length > 0}
        onLoaded={(name, code) => {
          quote.setClientName(name);
          quote.setClientCode(code);
          void quote.fetchQuoteItems();
          if (layout.isMobile) layout.setShowQuotePanel(true);
          else layout.setQuoteOpen(true);
        }}
      />

      {showPromoStyle && (
        <PromoQuoteOverlay
          clientName={quote.clientName || '거래처'}
          items={quote.quoteItems.map((it): PromoQuoteItem => ({
            code: it.item_code,
            name: it.korean_name || it.product_name || it.item_code,
            country: it.country || '',
            region: it.region || '',
            supply: it.supply_price || 0,
            rate: it.discount_rate || 0,
            qty: it.quantity || 1,
            note: it.note || '',
          }))}
          record={{ clientCode: quote.clientCode, company: activeTab, manager: getManagerParam() }}
          showSupply={visibleQuoteColumns.includes('supply_price')}
          showRate={visibleQuoteColumns.includes('discount_rate')}
          onClose={() => setShowPromoStyle(false)}
        />
      )}

      <ItemLedgerPopup popup={itemLedgerPopup} warehouse={activeTab} />
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
