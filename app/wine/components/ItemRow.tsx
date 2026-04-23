"use client";

import { WINE_COLORS, WINE_UNIT } from "../constants";
import type { ParseItem, Suggestion } from "../types";
import { monoStyle } from "./styles";
import { SuggestionRow } from "./SuggestionRow";

type Props = {
  item: ParseItem;
  index: number;
  isLast: boolean;
  showMore: boolean;
  toggleShowMore: () => void;
  suggestions: Suggestion[];
  allSuggestionsCount: number;
  saving: boolean;
  saved: boolean;
  newItemPrices: Record<string, string>;
  newItemDiscounts: Record<string, number>;
  onPriceChange: (itemKey: string, value: string) => void;
  onDiscountChange: (itemKey: string, value: number) => void;
  onApply: (itemIndex: number, s: Suggestion, price?: string) => void | Promise<void>;
};

const RESOLVED_LIMIT = 2;
const UNRESOLVED_LIMIT = 10;
const EXPANDED_LIMIT = 20;

/** 와인 품목 1행 + 후보 리스트 + 더보기 토글 */
export function ItemRow({
  item: it,
  index: idx,
  isLast,
  showMore,
  toggleShowMore,
  suggestions,
  allSuggestionsCount,
  saving,
  saved,
  newItemPrices,
  newItemDiscounts,
  onPriceChange,
  onDiscountChange,
  onApply,
}: Props) {
  const koreanName = it?.item_name?.split(" / ")[0] || it?.item_name || "";
  const displayName =
    it?.name !== undefined && it?.name !== null && String(it.name).trim() !== ""
      ? String(it.name).trim()
      : it?.raw || "이름없음";

  const line = it?.resolved
    ? `${it.item_no} / ${koreanName} / ${it.qty}${WINE_UNIT}`
    : `확인필요 / "${displayName}" / ${it.qty}${WINE_UNIT}`;

  return (
    <div
      style={{
        padding: "10px 0",
        borderBottom: isLast ? "none" : "1px solid #f2f2f2",
        display: "flex",
        gap: 10,
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", gap: 10 }}>
        <div
          style={{
            width: 80,
            color: it?.resolved ? WINE_COLORS.success : "#b00",
            fontWeight: 700,
          }}
        >
          {it?.resolved ? "확정" : "확인"}
        </div>
        <div style={{ flex: 1, ...monoStyle }}>{line}</div>
        <div
          style={{
            width: 70,
            textAlign: "right",
            color: "#777",
            fontVariantNumeric: "tabular-nums" as const,
          }}
        >
          {typeof it?.score === "number" ? it.score.toFixed(3) : ""}
        </div>
      </div>

      {suggestions.length > 0 && (
        <div style={{ marginLeft: 80, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
            👉 품목을 선택하면 결과에 즉시 반영됩니다
          </div>

          {suggestions.some((s) => s.is_new_item) && (
            <div
              style={{
                fontSize: 12,
                color: WINE_COLORS.primary,
                marginBottom: 12,
                padding: "8px 12px",
                background: WINE_COLORS.primaryBgLight,
                borderRadius: 6,
                border: `1px solid ${WINE_COLORS.primaryBorderStrong}`,
              }}
            >
              ⚠️ 신규 품목: 할인율과 공급가를 입력하세요
            </div>
          )}

          {suggestions.map((s, sidx) => {
            const itemKey = `${idx}-${s.item_no}`;
            const isNewItem = !!s.is_new_item;

            const onApplyClick = async () => {
              if (isNewItem && !newItemPrices[itemKey]) {
                alert("신규 품목은 공급가를 입력해주세요.");
                return;
              }
              let finalPrice = newItemPrices[itemKey];
              const discount = newItemDiscounts[itemKey];
              if (isNewItem && finalPrice && discount && discount > 0) {
                const base = Number(finalPrice);
                finalPrice = String(Math.round(base * (1 - discount / 100)));
              }
              const price = isNewItem ? finalPrice : undefined;
              await onApply(idx, s, price);
            };

            return (
              <SuggestionRow
                key={sidx}
                suggestion={s}
                itemKey={itemKey}
                saving={saving}
                saved={saved}
                priceInput={newItemPrices[itemKey] ?? ""}
                onPriceInputChange={(v) => onPriceChange(itemKey, v)}
                discount={newItemDiscounts[itemKey]}
                onDiscountChange={(v) => onDiscountChange(itemKey, v)}
                onApply={onApplyClick}
              />
            );
          })}

          <button
            onClick={toggleShowMore}
            style={{
              width: "100%",
              padding: "8px 12px",
              marginTop: 8,
              borderRadius: 6,
              border: `1px solid ${WINE_COLORS.dividerCardLight}`,
              background: "white",
              color: WINE_COLORS.primary,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {showMore
              ? `▲ 접기 (${allSuggestionsCount}개 중 ${Math.min(EXPANDED_LIMIT, allSuggestionsCount)}개 표시)`
              : it?.resolved
                ? allSuggestionsCount > RESOLVED_LIMIT
                  ? `▼ 더보기 (${allSuggestionsCount}개 중 ${RESOLVED_LIMIT}개 표시)`
                  : `총 ${allSuggestionsCount}개 후보`
                : allSuggestionsCount > UNRESOLVED_LIMIT
                  ? `▼ 더보기 (${allSuggestionsCount}개 중 ${Math.min(UNRESOLVED_LIMIT, allSuggestionsCount)}개 표시)`
                  : `총 ${allSuggestionsCount}개 후보`}
          </button>
        </div>
      )}

      {suggestions.length === 0 && (
        <div style={{ marginLeft: 80, fontSize: 12, color: "#888" }}>후보가 없습니다.</div>
      )}
    </div>
  );
}
