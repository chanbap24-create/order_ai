"use client";

import { useState } from "react";
import { CDV_DOC_DEFAULTS, DL_DOC_DEFAULTS } from "../constants/docDefaults";
import { formatWon } from "../lib/format";
import type {
  DocSettings,
  QuoteColumnConfig,
  QuoteColumnKey,
  QuoteItem,
  WarehouseTab,
} from "../types";
import { ClientSearchInput } from "./ClientSearchInput";
import { DocSettingsForm } from "./DocSettingsForm";
import { MobilePanelActions } from "./MobilePanelActions";
import { MobileQuoteItemCard } from "./MobileQuoteItemCard";
import { QuoteColumnSettings } from "./QuoteColumnSettings";

type Props = {
  activeTab: WarehouseTab;
  quoteItems: QuoteItem[];
  totalQty: number;
  totalNormal: number;
  totalDiscount: number;
  clientName: string;
  setClientName: (v: string) => void;
  setClientCode: (v: string | null) => void;
  onOpenSaved: () => void;
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
  visibleQuoteCols?: QuoteColumnConfig[];
  onClose: () => void;
  onMoveItem: (idx: number, dir: "up" | "down") => void;
  onDeleteItem: (id: number) => void;
  onOpenBottomSheet: (item: QuoteItem) => void;
  onClearAll: () => void;
  exporting: boolean;
  exportingNotes: boolean;
  onExport: () => void;
  noteMenuOpen: boolean;
  setNoteMenuOpen: (v: boolean) => void;
  onDownloadNotes: (format: "pdf" | "pptx") => void;
};

/** 모바일 슬라이드 패널 — 오버레이 + 본체(헤더/설정/목록/합계/액션) 조립 */
export function MobileQuotePanel(p: Props) {
  return (
    <>
      <div
        className="quote-slide-overlay"
        onClick={p.onClose}
        style={{
          position: "fixed",
          top: 56,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 899,
        }}
      />
      <div
        className="quote-slide-panel"
        style={{
          position: "fixed",
          top: 56,
          right: 0,
          bottom: 0,
          width: "100%",
          maxWidth: 400,
          background: "white",
          zIndex: 900,
          overflowY: "auto",
          boxShadow: "-4px 0 16px rgba(0,0,0,0.1)",
        }}
      >
        <PanelHeader
          itemCount={p.quoteItems.length}
          clientName={p.clientName}
          setClientName={p.setClientName}
          setClientCode={p.setClientCode}
          company={p.activeTab}
          onOpenSaved={p.onOpenSaved}
          onClose={p.onClose}
          showDocSettings={p.showDocSettings}
          setShowDocSettings={p.setShowDocSettings}
          showQuoteColumnSettings={p.showQuoteColumnSettings}
          setShowQuoteColumnSettings={p.setShowQuoteColumnSettings}
        />

        <div style={{ padding: 16 }}>
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

        <div style={{ padding: 16 }}>
          {p.quoteItems.length === 0 ? (
            <EmptyState />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {p.quoteItems.map((item, idx) => (
                <MobileQuoteItemCard
                  key={item.id}
                  item={item}
                  index={idx}
                  isFirst={idx === 0}
                  isLast={idx === p.quoteItems.length - 1}
                  visibleQuoteCols={p.visibleQuoteCols}
                  onOpen={() => p.onOpenBottomSheet(item)}
                  onMoveUp={() => p.onMoveItem(idx, "up")}
                  onMoveDown={() => p.onMoveItem(idx, "down")}
                  onDelete={() => p.onDeleteItem(item.id)}
                />
              ))}
            </div>
          )}

          {p.quoteItems.length > 0 && (
            <Totals
              itemCount={p.quoteItems.length}
              totalQty={p.totalQty}
              totalNormal={p.totalNormal}
              totalDiscount={p.totalDiscount}
            />
          )}

          <MobilePanelActions
            hasItems={p.quoteItems.length > 0}
            exporting={p.exporting}
            exportingNotes={p.exportingNotes}
            onExport={p.onExport}
            noteMenuOpen={p.noteMenuOpen}
            setNoteMenuOpen={p.setNoteMenuOpen}
            onDownloadNotes={p.onDownloadNotes}
            onClearAll={p.onClearAll}
          />
        </div>
      </div>
    </>
  );
}

function PanelHeader({
  itemCount,
  clientName,
  setClientName,
  setClientCode,
  company,
  onOpenSaved,
  onClose,
  showDocSettings,
  setShowDocSettings,
  showQuoteColumnSettings,
  setShowQuoteColumnSettings,
}: {
  itemCount: number;
  clientName: string;
  setClientName: (v: string) => void;
  setClientCode: (v: string | null) => void;
  company: string;
  onOpenSaved: () => void;
  onClose: () => void;
  showDocSettings: boolean;
  setShowDocSettings: (v: boolean) => void;
  showQuoteColumnSettings: boolean;
  setShowQuoteColumnSettings: (v: boolean) => void;
}) {
  const [clientFocused, setClientFocused] = useState(false);
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        background: "white",
        zIndex: 1,
        padding: "16px 16px 12px",
        borderBottom: "1px solid var(--border-default)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            fontSize: 20,
            cursor: "pointer",
            color: "var(--neutral-700)",
            padding: 0,
            lineHeight: 1,
          }}
        >
          ←
        </button>
        <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
          견적 목록
        </span>
        {itemCount > 0 && (
          <span
            style={{
              background: "var(--action)",
              color: "white",
              borderRadius: 12,
              padding: "2px 8px",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {itemCount}
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <ClientSearchInput
            clientName={clientName}
            setClientName={setClientName}
            setClientCode={setClientCode}
            focused={clientFocused}
            setFocused={setClientFocused}
            company={company}
            width="100%"
          />
        </div>
        <IconBtn active={false} onClick={onOpenSaved} title="저장된 견적">🗂</IconBtn>
        <IconBtn active={showDocSettings} onClick={() => setShowDocSettings(!showDocSettings)} title="문서 설정">📄</IconBtn>
        <IconBtn
          active={showQuoteColumnSettings}
          onClick={() => setShowQuoteColumnSettings(!showQuoteColumnSettings)}
          title="컬럼 설정"
        >⚙</IconBtn>
      </div>
    </div>
  );
}

function IconBtn({ active, onClick, title, children }: {
  active: boolean; onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={title}
      style={{
        width: 36, height: 36, borderRadius: 8, border: "1px solid var(--border-default)",
        background: active ? "var(--border-default)" : "white",
        cursor: "pointer", fontSize: 15, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--neutral-100)" }}>
      <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--neutral-700)" }}>No items yet</div>
      <div style={{ fontSize: "0.75rem", marginTop: 4 }}>검색 결과에서 + 버튼으로 추가</div>
    </div>
  );
}

function Totals({ itemCount, totalQty, totalNormal, totalDiscount }: {
  itemCount: number; totalQty: number; totalNormal: number; totalDiscount: number;
}) {
  return (
    <div
      style={{
        marginTop: 16, paddingTop: 12,
        borderTop: "2px solid var(--border-strong)", fontSize: 13,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ color: "var(--neutral-400)" }}>품목 {itemCount}개 / 수량 {totalQty}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ color: "var(--neutral-400)" }}>정상합계</span>
        <span style={{ fontWeight: 600 }}>{formatWon(totalNormal)}원</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: "var(--action)" }}>
        <span>할인합계</span>
        <span>{formatWon(totalDiscount)}원</span>
      </div>
    </div>
  );
}

