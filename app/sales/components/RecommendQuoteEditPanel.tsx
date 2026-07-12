'use client';

import { useEffect, useRef, useState } from 'react';
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
import { QuoteItemSearchAdd } from '@/app/sales/recommend/components/QuoteItemSearchAdd';

type Props = {
  quote: ReturnType<typeof useQuoteItems>;
  getManagerParam: () => string;
};

// 견적 편집 컬럼: 계정(user_preferences) + localStorage 저장. 마운트마다 기본값으로 리셋되던 문제 방지.
const COLS_KEY = 'recommend_edit_columns';

/**
 * 추천견적 하단 견적 편집 패널 — /inventory 의 견적 빌더(DesktopSidebarContainer)를 그대로 재사용.
 * 할인률·수량 인라인 편집, 컬럼 표시/순서, 문서설정, 엑셀/테이스팅노트 발행까지 동일 기능.
 */
export function RecommendQuoteEditPanel({ quote, getManagerParam }: Props) {
  const [visibleQuoteColumns, setVisibleQuoteColumns] = useState<QuoteColumnKey[]>(() => {
    if (typeof window !== 'undefined') {
      try { const s = localStorage.getItem(COLS_KEY); if (s) return JSON.parse(s) as QuoteColumnKey[]; } catch { /* ignore */ }
    }
    return DEFAULT_QUOTE_VISIBLE;
  });
  const colsLoaded = useRef(false);
  // 계정 저장값 로드(기기 무관 유지)
  useEffect(() => {
    let alive = true;
    fetch('/api/user/preferences', { credentials: 'include' })
      .then(r => r.json())
      .then(j => { const v = j?.preferences?.[COLS_KEY]; if (alive && Array.isArray(v) && v.length) setVisibleQuoteColumns(v); })
      .catch(() => {})
      .finally(() => { colsLoaded.current = true; });
    return () => { alive = false; };
  }, []);
  // 변경 시 localStorage(즉시) + 계정 저장
  useEffect(() => {
    try { localStorage.setItem(COLS_KEY, JSON.stringify(visibleQuoteColumns)); } catch { /* ignore */ }
    if (!colsLoaded.current) return;
    fetch('/api/user/preferences', {
      method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: COLS_KEY, value: visibleQuoteColumns }),
    }).catch(() => {});
  }, [visibleQuoteColumns]);
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
      <div>
        <QuoteItemSearchAdd onAdd={quote.addToQuote} />
        <div style={{
          textAlign: 'center', padding: '28px 20px', color: 'var(--text-muted)', fontSize: 13,
          border: '1px dashed var(--action-muted)', borderRadius: 12,
        }}>
          추천에서 와인을 선택해 <b>“견적에 담기”</b>를 누르거나, 위에서 <b>직접 검색해 담을</b> 수 있습니다.
        </div>
      </div>
    );
  }

  return (
    <div>
      <QuoteItemSearchAdd onAdd={quote.addToQuote} />
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
        fullWidth
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
