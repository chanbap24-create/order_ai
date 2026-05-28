"use client";

import { CDV_DOC_DEFAULTS, DL_DOC_DEFAULTS } from "../constants/docDefaults";
import { formatWon } from "../lib/format";
import type {
  DocSettings,
  QuoteColumnConfig,
  QuoteColumnKey,
  QuoteItem,
  WarehouseTab,
} from "../types";
import { DesktopSidebarHeader } from "./DesktopSidebarHeader";
import { DocSettingsForm } from "./DocSettingsForm";
import { QuoteColumnSettings } from "./QuoteColumnSettings";
import { QuoteTable, type EditCell } from "./QuoteTable";

type Props = {
  activeTab: WarehouseTab;
  quoteItems: QuoteItem[];
  quoteLoading: boolean;
  totalQty: number;
  totalNormal: number;
  totalDiscount: number;
  totalRetailNormal: number;
  totalRetailDiscount: number;
  // client name
  clientName: string;
  setClientName: (v: string) => void;
  clientNameFocused: boolean;
  setClientNameFocused: (v: boolean) => void;
  // settings
  showDocSettings: boolean;
  setShowDocSettings: (v: boolean) => void;
  docSettings: DocSettings;
  setDocSettings: (updater: (prev: DocSettings) => DocSettings) => void;
  resetDocSettings: (defaults: DocSettings) => void;
  showQuoteColumnSettings: boolean;
  setShowQuoteColumnSettings: (v: boolean) => void;
  visibleQuoteColumns: QuoteColumnKey[];
  setVisibleQuoteColumns: (
    updater: (prev: QuoteColumnKey[]) => QuoteColumnKey[],
  ) => void;
  visibleQuoteCols: QuoteColumnConfig[];
  // table inline edit
  editCell: EditCell;
  editValue: string;
  setEditCell: (c: EditCell) => void;
  setEditValue: (v: string) => void;
  startEdit: (id: number, key: string, val: any) => void;
  commitEdit: () => void;
  getQuoteCellValue: (item: QuoteItem, key: string) => any;
  formatQuoteCellValue: (item: QuoteItem, col: QuoteColumnConfig) => string;
  tastingNoteSet: Set<string>;
  // actions
  onReorderItemTo?: (fromIdx: number, toIdx: number) => void;
  onDeleteItem: (id: number) => void;
  onClearAll: () => void;
  onReorderColumns: (
    updater: (prev: QuoteColumnConfig[]) => QuoteColumnConfig[],
  ) => void;
};

/** 데스크톱 우측 견적 사이드바 — 헤더/설정/테이블/합계 */
export function DesktopQuoteSidebar(p: Props) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        maxWidth: "50%",
        position: "sticky",
        top: 72,
        alignSelf: "flex-start",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 12,
          border: "1.5px solid #E5E5E5",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          maxHeight: "calc(100vh - 88px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <DesktopSidebarHeader
          itemCount={p.quoteItems.length}
          clientName={p.clientName}
          setClientName={p.setClientName}
          clientNameFocused={p.clientNameFocused}
          setClientNameFocused={p.setClientNameFocused}
          showDocSettings={p.showDocSettings}
          setShowDocSettings={p.setShowDocSettings}
          showQuoteColumnSettings={p.showQuoteColumnSettings}
          setShowQuoteColumnSettings={p.setShowQuoteColumnSettings}
          onClearAll={p.onClearAll}
        />

        {/* 설정 패널은 별도 (column flex 의 flex-shrink:0) */}
        {(p.showDocSettings || p.showQuoteColumnSettings) && (
          <div style={{ padding: 16, borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
            {p.showDocSettings && (
              <DocSettingsForm
                docSettings={p.docSettings}
                setDocSettings={p.setDocSettings}
                onResetDefaults={() =>
                  p.resetDocSettings(p.activeTab === "CDV" ? CDV_DOC_DEFAULTS : DL_DOC_DEFAULTS)
                }
              />
            )}
            {p.showQuoteColumnSettings && (
              <QuoteColumnSettings
                visibleColumns={p.visibleQuoteColumns}
                setVisibleColumns={p.setVisibleQuoteColumns}
              />
            )}
          </div>
        )}

        {/* 테이블 영역 — 안쪽에서 X+Y 동시 스크롤. thead sticky top + 순서 컬럼 sticky left */}
        <div style={{ flex: 1, minHeight: 0, padding: "0 16px 16px", display: "flex", flexDirection: "column" }}>
          {p.quoteLoading && (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: "#999",
                fontSize: "0.82rem",
              }}
            >
              견적 불러오는 중...
            </div>
          )}

          {p.quoteItems.length > 0 && (
            <QuoteTable
              visibleQuoteCols={p.visibleQuoteCols}
              quoteItems={p.quoteItems}
              totalQty={p.totalQty}
              totalNormal={p.totalNormal}
              totalDiscount={p.totalDiscount}
              totalRetailNormal={p.totalRetailNormal}
              totalRetailDiscount={p.totalRetailDiscount}
              editCell={p.editCell}
              editValue={p.editValue}
              setEditCell={p.setEditCell}
              setEditValue={p.setEditValue}
              startEdit={p.startEdit}
              commitEdit={p.commitEdit}
              getQuoteCellValue={p.getQuoteCellValue}
              formatQuoteCellValue={p.formatQuoteCellValue}
              tastingNoteSet={p.tastingNoteSet}
              onReorderItemTo={p.onReorderItemTo}
              onDeleteItem={p.onDeleteItem}
              onReorderColumns={p.onReorderColumns}
            />
          )}
        </div>

        {/* 합계 — 사이드바 최하단 고정 (항상 보임, 콘텐츠 스크롤과 무관) */}
        {p.quoteItems.length > 0 && (
          <div
            style={{
              flexShrink: 0,
              borderTop: "1px solid var(--border-subtle)",
              background: "var(--surface)",
              padding: "12px 16px",
            }}
          >
            <TotalsSummary
              itemCount={p.quoteItems.length}
              totalQty={p.totalQty}
              totalNormal={p.totalNormal}
              totalDiscount={p.totalDiscount}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function TotalsSummary({
  itemCount, totalQty, totalNormal, totalDiscount,
}: {
  itemCount: number; totalQty: number; totalNormal: number; totalDiscount: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        flexWrap: "wrap",
        fontSize: 13,
        color: "#666",
        alignItems: "center",
      }}
    >
      <span>품목 <strong>{itemCount}</strong>개 / 수량 <strong>{totalQty}</strong></span>
      <span>정상합계 <strong style={{ color: "#2c3e50" }}>{formatWon(totalNormal)}원</strong></span>
      <span>할인합계 <strong style={{ color: "var(--action)" }}>{formatWon(totalDiscount)}원</strong></span>
      {totalNormal > 0 && totalNormal !== totalDiscount && (
        <span style={{ color: "#27ae60", fontWeight: 600 }}>
          {formatWon(totalNormal - totalDiscount)}원 할인
        </span>
      )}
    </div>
  );
}
