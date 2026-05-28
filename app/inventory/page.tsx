'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  InventoryItem,
  QuoteItem,
  WarehouseTab,
  InvColumnKey,
  QuoteColumnKey,
  QuoteColumnConfig,
  DocSettings,
} from './types';
import {
  INV_COLUMNS,
  DEFAULT_INV_CDV,
  DEFAULT_INV_DL,
  QUOTE_COLUMNS,
  DEFAULT_QUOTE_VISIBLE,
} from './constants/columns';
import { CDV_DOC_DEFAULTS } from './constants/docDefaults';
import { calcDiscountedPrice } from './lib/priceCalc';
import { CACHE_TTL, getCached, setCached } from '@/app/lib/sessionCache';
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
import { useQuoteExports } from './hooks/useQuoteExports';

export default function InventoryPage() {
  const prefs = useServerPreferences();

  // ── 페이지에 남는 state ──
  const [activeTab, setActiveTab] = useState<WarehouseTab>('CDV');
  const [countryList, setCountryList] = useState<string[]>([]);
  const [visibleColumnsCDV, setVisibleColumnsCDV] = useState<InvColumnKey[]>(DEFAULT_INV_CDV);
  const [visibleColumnsDL, setVisibleColumnsDL] = useState<InvColumnKey[]>(DEFAULT_INV_DL);
  const [visibleQuoteColumns, setVisibleQuoteColumns] =
    useState<QuoteColumnKey[]>(DEFAULT_QUOTE_VISIBLE);
  const [docSettings, setDocSettings] = useState<DocSettings>(CDV_DOC_DEFAULTS);
  const [showInvColumnSettings, setShowInvColumnSettings] = useState(false);
  const [showQuoteColumnSettings, setShowQuoteColumnSettings] = useState(false);
  const [showDocSettings, setShowDocSettings] = useState(false);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [clientNameFocused, setClientNameFocused] = useState(false);

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
    activeTab,
    visibleQuoteColumns,
    docSettings,
    getManagerParam,
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

  // ══════════════════════════════════════
  // EFFECTS
  // ══════════════════════════════════════

  useEffect(() => {
    const cacheKey = `inventory_countries_${activeTab}`;
    const cached = getCached<string[]>(cacheKey, CACHE_TTL.COUNTRIES);
    if (cached) setCountryList(cached);

    fetch(`/api/inventory/countries?tab=${activeTab}`)
      .then(r => r.json())
      .then(d => {
        const list = d.countries || [];
        setCountryList(list);
        setCached(cacheKey, list);
      })
      .catch(() => {});
  }, [activeTab]);

  useInventoryPreferences(
    prefs,
    { setActiveTab, setVisibleColumnsCDV, setVisibleColumnsDL, setVisibleQuoteColumns, setDocSettings },
    { activeTab, visibleColumnsCDV, visibleColumnsDL, visibleQuoteColumns, docSettings },
  );

  // ══════════════════════════════════════
  // COMPUTED VALUES
  // ══════════════════════════════════════

  const invColumnOrder = INV_COLUMNS.map(c => c.key);
  const rawInvVisible = activeTab === 'CDV' ? visibleColumnsCDV : visibleColumnsDL;
  const visibleInvColumns = [...new Set(rawInvVisible)].sort(
    (a, b) => invColumnOrder.indexOf(a) - invColumnOrder.indexOf(b),
  );

  const availableInvColumns = INV_COLUMNS.filter(col => {
    if (activeTab === 'CDV') return !col.dlOnly;
    if (activeTab === 'DL') return !col.cdvOnly;
    return true;
  });

  const visibleQuoteCols = visibleQuoteColumns
    .map(key => QUOTE_COLUMNS.find(c => c.key === key))
    .filter(Boolean) as QuoteColumnConfig[];

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

      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '24px 16px', fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
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
        />
      </div>

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
