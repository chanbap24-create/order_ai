"use client";

import { WINE_COLORS } from "../constants";
import { getSuggestions } from "../lib/suggestions";
import type { ParseItem, Suggestion } from "../types";
import { ItemRow } from "./ItemRow";

type Props = {
  items: ParseItem[];
  open: boolean;
  toggleOpen: () => void;
  showMoreSuggestions: Record<number, boolean>;
  toggleShowMore: (idx: number) => void;
  savingPick: Record<number, boolean>;
  savedPick: Record<number, boolean>;
  newItemPrices: Record<string, string>;
  newItemDiscounts: Record<string, number>;
  onPriceChange: (itemKey: string, value: string) => void;
  onDiscountChange: (itemKey: string, value: number) => void;
  onApply: (itemIndex: number, s: Suggestion, price?: string) => void | Promise<void>;
};

/** "품목 결과" 접기 카드 + ItemRow 목록 */
export function ItemsResultSection({
  items,
  open,
  toggleOpen,
  showMoreSuggestions,
  toggleShowMore,
  savingPick,
  savedPick,
  newItemPrices,
  newItemDiscounts,
  onPriceChange,
  onDiscountChange,
  onApply,
}: Props) {
  return (
    <div style={{ marginTop: 12 }}>
      <button
        onClick={toggleOpen}
        style={{
          width: "100%",
          padding: "14px 18px",
          background: WINE_COLORS.surface,
          border: `1px solid ${WINE_COLORS.dividerCard}`,
          borderRadius: open ? "16px 16px 0 0" : 16,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 14,
          fontWeight: 700,
          color: WINE_COLORS.text,
          boxShadow: "0 1px 4px rgba(90,21,21,0.02)",
          transition: "border-radius 0.2s ease",
        }}
      >
        <span>품목 결과</span>
        <span
          style={{
            fontSize: 11,
            color: WINE_COLORS.textMuted,
            transition: "transform 0.2s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          &#9660;
        </span>
      </button>

      {open && (
        <div
          style={{
            padding: "16px 18px",
            background: WINE_COLORS.surface,
            borderRadius: "0 0 16px 16px",
            border: `1px solid ${WINE_COLORS.dividerCard}`,
            borderTop: "none",
            boxShadow: WINE_COLORS.primaryShadowSubtle,
          }}
        >
          {items.map((it, idx) => {
            const showMore = !!showMoreSuggestions[idx];
            const list = getSuggestions(it, showMore);
            const allCount =
              Array.isArray(it?.suggestions) && it.suggestions.length > 0
                ? it.suggestions.length
                : Array.isArray(it?.candidates)
                  ? it.candidates.length
                  : 0;

            return (
              <ItemRow
                key={idx}
                item={it}
                index={idx}
                isLast={idx === items.length - 1}
                showMore={showMore}
                toggleShowMore={() => toggleShowMore(idx)}
                suggestions={list}
                allSuggestionsCount={allCount}
                saving={!!savingPick[idx]}
                saved={!!savedPick[idx]}
                newItemPrices={newItemPrices}
                newItemDiscounts={newItemDiscounts}
                onPriceChange={onPriceChange}
                onDiscountChange={onDiscountChange}
                onApply={onApply}
              />
            );
          })}
          {items.length === 0 && <div style={{ color: "var(--neutral-200)" }}>품목 결과가 없습니다.</div>}
        </div>
      )}
    </div>
  );
}
