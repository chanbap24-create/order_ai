"use client";

import type { RefObject } from "react";
import { applyDiscount, getSelected } from "../lib/priceCalc";
import type { OrderLine, SearchResult } from "../types";
import { CandidateList } from "./CandidateList";
import { ManualSearchBox } from "./ManualSearchBox";
import { OrderLineCompact } from "./OrderLineCompact";
import {
  PriceDiscountEditor,
  commitPriceText,
  resolveDiscountChange,
} from "./PriceDiscountEditor";
import { QuantityEditor } from "./QuantityEditor";

type Props = {
  line: OrderLine;
  lineIdx: number;
  tab: "CDV" | "DL";
  historySet: Set<string>;

  // expand
  isExpanded: boolean;
  toggleExpand: () => void;

  // qty
  editingQty?: string;
  onEditQty: (val: string) => void;
  onCommitQty: () => void;
  onDecQty: () => void;
  onIncQty: () => void;
  onRemoveLine: () => void;

  // candidates
  onSelectCandidate: (candIdx: number) => void;

  // manual search
  isSearching: boolean;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  searchResults: SearchResult[];
  searchLoading: boolean;
  searchRef: RefObject<HTMLDivElement | null>;
  onOpenSearch: () => void;
  onPickSearch: (wine: SearchResult) => void;

  // price / discount
  discount: number;
  editingPrice?: string;
  onEditPrice: (val: string) => void;
  onCommitPrice: () => void;
  customDiscountInput?: string;
  onDiscountSelectChange: (v: string) => void;
  onCustomDiscountChange: (raw: string) => void;
  onCustomDiscountBlur: () => void;
};

/** 품목 1행 — compact 헤더 + (펼칠 시) 수량/후보/검색/가격 편집 */
export function OrderLineCard(p: Props) {
  const sel = getSelected(p.line);
  const discPrice = sel ? applyDiscount(sel.supply_price, p.discount) : 0;

  return (
    <div
      className="order-line-card"
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1px solid var(--action-muted)",
        overflow: "hidden",
        transition: "border-color 0.2s ease",
      }}
    >
      <OrderLineCompact
        line={p.line}
        tab={p.tab}
        isExpanded={p.isExpanded}
        onToggle={p.toggleExpand}
      />

      {p.isExpanded && (
        <div
          style={{
            borderTop: "1px solid var(--border-subtle)",
            animation: "orderSlideIn 0.15s ease",
          }}
        >
          <QuantityEditor
            query={p.line.query}
            quantity={p.line.quantity}
            editingValue={p.editingQty}
            onEdit={p.onEditQty}
            onCommit={p.onCommitQty}
            onDec={p.onDecQty}
            onInc={p.onIncQty}
            onRemove={p.onRemoveLine}
          />

          <div style={{ padding: "4px 0" }}>
            <CandidateList
              candidates={p.line.candidates}
              selectedIdx={p.line.selectedIdx}
              historySet={p.historySet}
              onSelect={p.onSelectCandidate}
            />

            <ManualSearchBox
              lineIdx={p.lineIdx}
              isSearching={p.isSearching}
              query={p.searchQuery}
              setQuery={p.setSearchQuery}
              results={p.searchResults}
              loading={p.searchLoading}
              containerRef={p.searchRef}
              onOpen={p.onOpenSearch}
              onPick={p.onPickSearch}
              historySet={p.historySet}
            />
          </div>

          {sel && (
            <PriceDiscountEditor
              lineIdx={p.lineIdx}
              selected={sel}
              discount={p.discount}
              discountedPrice={discPrice}
              editingPrice={p.editingPrice}
              onEditPrice={p.onEditPrice}
              onCommitPrice={p.onCommitPrice}
              customDiscountInput={p.customDiscountInput}
              onDiscountSelect={p.onDiscountSelectChange}
              onCustomDiscountChange={p.onCustomDiscountChange}
              onCustomDiscountBlur={p.onCustomDiscountBlur}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** 편의 re-export: select/price 해석은 PriceDiscountEditor에서 가져다 쓴다 */
export { commitPriceText, resolveDiscountChange };
