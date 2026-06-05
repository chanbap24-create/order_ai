"use client";

import { GLASS_COLORS } from "../constants";
import { getGlassUnit } from "../lib/glassUnit";
import { monoStyle } from "./styles";
import { SuggestionRow } from "./SuggestionRow";

type Props = {
  item: any;
  index: number;
  isLast: boolean;
  showMore: boolean;
  toggleShowMore: () => void;
  suggestions: any[];
  allSuggestions: any[];
  wasJustPicked: boolean;
  saving: boolean;
  newItemPrices: Record<string, string>;
  newItemDiscounts: Record<number, number>;
  onPriceChange: (itemKey: string, value: string) => void;
  onDiscountChange: (itemKey: string, value: number) => void;
  onApply: (itemIndex: number, s: any, price?: string) => void | Promise<void>;
};

/**
 * 품목 1건 + 후보 리스트 + 미입고 경고 + 더보기 토글.
 */
export function ItemRow({
  item: it,
  index: idx,
  isLast,
  showMore,
  toggleShowMore,
  suggestions: top3,
  allSuggestions,
  wasJustPicked,
  saving,
  newItemPrices,
  newItemDiscounts,
  onPriceChange,
  onDiscountChange,
  onApply,
}: Props) {
  const resolvedUnit = it?.resolved && it?.item_name
    ? getGlassUnit(it.item_name)
    : getGlassUnit(it?.item_name || it?.name || "");
  const line = it?.resolved
    ? `${it.item_no} / ${it.item_name} / ${it.qty}${resolvedUnit}`
    : it?.item_no && it?.not_in_client_history
      ? `${it.item_no} / ${it.item_name} / ${it.qty}${resolvedUnit}`
      : `확인필요 / "${it.name}" / ${it.qty}${resolvedUnit}`;

  const isNotInClientHistory = !!it?.not_in_client_history && !it?.resolved;

  return (
    <div
      style={{
        padding: "10px 12px",
        borderBottom: isLast ? "none" : "1px solid var(--gray-100)",
        display: "flex",
        gap: 10,
        flexDirection: "column",
        background: it?.resolved
          ? wasJustPicked
            ? "#d4edda"
            : "#eaf7ee"
          : "transparent",
        borderRadius: 8,
        transition: "background 0.4s ease",
        marginBottom: 4,
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div
          style={{
            width: 80,
            color: it?.resolved
              ? GLASS_COLORS.success
              : isNotInClientHistory
                ? "#e8a820"
                : "#b00",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {it?.resolved ? "확정 ✅" : isNotInClientHistory ? "미입고 ⚠️" : "확인 ❗"}
        </div>
        <div style={{ flex: 1, ...monoStyle, fontSize: 13 }}>{line}</div>
        <div
          style={{
            width: 70,
            textAlign: "right",
            color: "var(--neutral-300)",
            fontVariantNumeric: "tabular-nums" as const,
          }}
        >
          {typeof it?.score === "number" ? it.score.toFixed(3) : ""}
        </div>
      </div>

      {isNotInClientHistory && (
        <div
          style={{
            padding: "8px 12px",
            background: "#fff8e1",
            border: "1px solid #ffc107",
            borderRadius: 6,
            fontSize: 12,
            color: "#856404",
            fontWeight: 600,
          }}
        >
          ⚠️ 이 거래처에 입고된 적 없는 품목입니다. 코드 매칭은 확인되었으나 확인이 필요합니다.
        </div>
      )}

      {(top3.length > 0 || allSuggestions.length > 0) && (!it?.resolved || showMore) && (
        <div style={{ marginLeft: 80, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, color: "var(--neutral-400)" }}>
            👉 아래 후보 중 하나를 선택하면 결과/직원메시지가 즉시 반영됩니다
          </div>

          {top3.some((s: any) => s.is_new_item || !s.in_client_history) && (
            <div
              style={{
                fontSize: 12,
                color: GLASS_COLORS.primary,
                marginBottom: 8,
                padding: "8px 12px",
                background: GLASS_COLORS.primaryBgLight,
                borderRadius: 6,
                border: `1px solid ${GLASS_COLORS.primaryBorderStrong}`,
              }}
            >
              ⚠️ 신규/미입고 품목: 할인율과 공급가를 확인하세요
            </div>
          )}

          {top3.map((s: any, sidx: number) => {
            const itemKey = `${idx}-${s.code || s.item_no}`;
            const isNewItem = !!s.is_new_item;
            const inClientHistory = !!s.in_client_history;
            const needsPriceInput = isNewItem || !inClientHistory;

            const onApplyClick = async () => {
              const inputPrice =
                newItemPrices[itemKey] || (s.supply_price ? String(s.supply_price) : "");
              let finalPrice = inputPrice;
              const discount = newItemDiscounts[itemKey as any];
              if (needsPriceInput && inputPrice && discount && discount > 0) {
                const base = Number(inputPrice);
                finalPrice = String(Math.round(base * (1 - discount / 100)));
              }
              const price = needsPriceInput && finalPrice ? finalPrice : undefined;
              await onApply(idx, s, price);
            };

            return (
              <SuggestionRow
                key={sidx}
                itemIndex={idx}
                suggestion={s}
                itemKey={itemKey}
                saving={saving}
                saved={wasJustPicked}
                needsPriceInput={needsPriceInput}
                priceInput={newItemPrices[itemKey] ?? ""}
                onPriceInputChange={(v) => onPriceChange(itemKey, v)}
                discount={newItemDiscounts[itemKey as any]}
                onDiscountChange={(v) => onDiscountChange(itemKey, v)}
                onApply={onApplyClick}
              />
            );
          })}

          <button onClick={toggleShowMore} style={moreButtonStyle}>
            {showMore
              ? `▲ 접기 (${allSuggestions.length}개 중 ${Math.min(20, allSuggestions.length)}개 표시)`
              : it?.resolved
                ? allSuggestions.length > 2
                  ? `▼ 더보기 (${allSuggestions.length}개 중 2개 표시)`
                  : `총 ${allSuggestions.length}개 후보`
                : allSuggestions.length > 5
                  ? `▼ 더보기 (${allSuggestions.length}개 중 5개 표시)`
                  : `총 ${allSuggestions.length}개 후보`}
          </button>
        </div>
      )}

      {it?.resolved && wasJustPicked && (
        <div
          style={{ marginLeft: 80, fontSize: 12, color: GLASS_COLORS.success, fontWeight: 600 }}
        >
          직원 메시지에 반영되었습니다
        </div>
      )}

      {it?.resolved && !showMore && allSuggestions.length > 0 && (
        <div style={{ marginLeft: 80 }}>
          <button onClick={toggleShowMore} style={{ ...moreButtonStyle, width: "auto" }}>
            ▼ 다른 후보 보기 ({allSuggestions.length}개)
          </button>
        </div>
      )}

      {top3.length === 0 && !it?.resolved && (
        <div style={{ marginLeft: 80, fontSize: 12, color: "var(--neutral-200)" }}>후보가 없습니다.</div>
      )}
    </div>
  );
}

const moreButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  marginTop: 8,
  borderRadius: 6,
  border: `1px solid ${GLASS_COLORS.dividerCardLight}`,
  background: "white",
  color: GLASS_COLORS.primary,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
};
