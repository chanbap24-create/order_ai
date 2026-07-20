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
import { renderQuoteImage } from '@/app/sales/recommend/lib/quoteImage';
import { renderQuoteCardImage } from '@/app/sales/recommend/lib/quoteCardImage';

// 견적 편집 컬럼(인벤토리 키) → PNG 컬럼 키 매핑. 순서 유지·중복 제거.
const PNG_COL_MAP: Record<string, string> = {
  item_name: 'product_name', product_name: 'product_name',
  country: 'country', brand: 'brand', region: 'region',
  grape_varieties: 'grape_varieties', vintage: 'vintage',
  supply_price: 'supply_price', discount_rate: 'discount_rate',
  discounted_price: 'discounted_price', discount_price: 'discounted_price',
  note: 'note', quantity: 'quantity',
  normal_total: 'normal_total', discount_total: 'discount_total',
};

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

  // 카톡 전송용 PNG 견적서 — 편집한 견적(할인·수량·컬럼) 그대로 이미지로.
  const [pngBusy, setPngBusy] = useState(false);
  const handleExportPng = async () => {
    if (items.length === 0) return;
    inlineEdit.commitEdit(); // 편집 중인 셀 반영
    setPngBusy(true);
    try {
      const pngCols: string[] = [];
      for (const k of visibleQuoteColumns) {
        const mapped = PNG_COL_MAP[k];
        if (mapped && !pngCols.includes(mapped)) pngCols.push(mapped);
      }
      const blob = await renderQuoteImage({
        clientName: quote.clientName || '거래처',
        date: new Date().toISOString().slice(0, 10),
        cols: pngCols,
        items: items.map((it) => ({
          name: it.product_name || it.item_name || '',
          country: it.country || '',
          brand: it.brand || '',
          region: it.region || '',
          grape: quote.wineProfiles[it.item_code]?.grape_varieties || '',
          vintage: it.vintage && it.vintage !== '-' ? it.vintage : '',
          supply: it.supply_price || 0,
          rate: it.discount_rate || 0,
          qty: it.quantity || 1,
          note: it.note || '',
        })),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `견적표_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${(quote.clientName || '거래처').replace(/[\\/:*?"<>|]/g, '_')}.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { alert('이미지 견적서 생성에 실패했습니다.'); }
    finally { setPngBusy(false); }
  };

  // 상세카드 이미지 — 병 사진·큰 할인가(카톡 홍보용)
  const [cardBusy, setCardBusy] = useState(false);
  const handleExportCard = async () => {
    if (items.length === 0) return;
    inlineEdit.commitEdit();
    setCardBusy(true);
    try {
      let flavorMap: Record<string, string[]> = {};
      try {
        const fr = await fetch('/api/sales/flavor-tags', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codes: items.map((it) => it.item_code) }),
        });
        flavorMap = (await fr.json())?.tags || {};
      } catch { /* 향미 없어도 진행 */ }
      const blob = await renderQuoteCardImage({
        clientName: quote.clientName || '거래처',
        date: new Date().toISOString().slice(0, 10),
        logoUrl: '/logos/cavedevin.png',
        items: items.map((it) => ({
          name: it.product_name || it.item_name || '',
          brandKr: it.brand || '',
          country: it.country || '',
          region: it.region || '',
          vintage: it.vintage && it.vintage !== '-' ? it.vintage : '',
          grape: quote.wineProfiles[it.item_code]?.grape_varieties || '',
          supply: it.supply_price || 0,
          rate: it.discount_rate || 0,
          qty: it.quantity || 1,
          note: it.note || '',
          imageUrl: it.image_url || '',
          flavors: flavorMap[it.item_code] || [],
        })),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `상세카드_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${(quote.clientName || '거래처').replace(/[\\/:*?"<>|]/g, '_')}.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { alert('상세카드 이미지 생성에 실패했습니다.'); }
    finally { setCardBusy(false); }
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
          {exports.exporting ? '생성 중…' : '엑셀 견적서'}
        </button>
        <button onClick={handleExportCard} disabled={cardBusy} title="병 사진·큰 할인가가 있는 상세카드 이미지(카톡 홍보용)"
          style={{ ...btn, opacity: cardBusy ? 0.6 : 1 }}>
          {cardBusy ? '생성 중…' : '🖼 상세카드 이미지'}
        </button>
        <button onClick={handleExportPng} disabled={pngBusy} title="엑셀 견적서 양식 그대로의 이미지(견적표)"
          style={{ ...btn, opacity: pngBusy ? 0.6 : 1 }}>
          {pngBusy ? '생성 중…' : '견적표 이미지'}
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
