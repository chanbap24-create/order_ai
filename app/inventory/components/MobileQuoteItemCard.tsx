"use client";

import { formatPercent, formatWon } from "../lib/format";
import { roundTo100 } from "@/app/lib/priceUtils";
import { calcDiscountedPrice } from "../lib/priceCalc";
import type { QuoteColumnConfig, QuoteItem } from "../types";

type Props = {
  item: QuoteItem;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  /** 데스크탑과 동일한 활성 컬럼 목록 — 카드 내 필드 표시 여부 결정 */
  visibleQuoteCols?: QuoteColumnConfig[];
  onOpen: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
};

/** 모바일 패널의 견적 항목 1개 카드 — visibleQuoteCols 따라 필드 동적 표시 */
export function MobileQuoteItemCard({
  item,
  index,
  isFirst,
  isLast,
  visibleQuoteCols,
  onOpen,
  onMoveUp,
  onMoveDown,
  onDelete,
}: Props) {
  const discounted = calcDiscountedPrice(
    item.supply_price,
    item.discount_rate,
    item.discounted_price,
  );
  const retailDiscounted = roundTo100(item.retail_price * (1 - item.discount_rate));
  const normalTotal = item.supply_price * item.quantity;
  const discountTotal = discounted * item.quantity;
  const minPriceTotal = item.min_price * item.quantity;
  const retailNormalTotal = item.retail_price * item.quantity;
  const retailDiscountTotal = retailDiscounted * item.quantity;

  // 컬럼 활성 여부 — visibleQuoteCols 없으면 기본(공급가/할인율/할인가/수량) 표시
  const visibleKeys = new Set(visibleQuoteCols?.map((c) => c.key) ?? [
    "supply_price",
    "discount_rate",
    "discounted_price",
    "quantity",
    "normal_total",
    "discount_total",
  ]);
  const has = (k: string) => visibleKeys.has(k);

  // 가격/수치 필드 (그리드 형태로 wrap)
  const valueFields: { key: string; label: string; value: string; color?: string }[] = [];
  if (has("supply_price")) valueFields.push({ key: "supply_price", label: "공급가", value: formatWon(item.supply_price) });
  if (has("min_price")) valueFields.push({ key: "min_price", label: "최저판매가", value: formatWon(item.min_price) });
  if (has("retail_price")) valueFields.push({ key: "retail_price", label: "판매가", value: formatWon(item.retail_price) });
  if (has("discount_rate")) valueFields.push({ key: "discount_rate", label: "할인율", value: formatPercent(item.discount_rate), color: "var(--action)" });
  if (has("discounted_price")) valueFields.push({ key: "discounted_price", label: "할인가", value: formatWon(discounted), color: "var(--action)" });
  if (has("retail_discounted_price")) valueFields.push({ key: "retail_discounted_price", label: "할인판매가", value: formatWon(retailDiscounted), color: "var(--action)" });
  if (has("quantity")) valueFields.push({ key: "quantity", label: "수량", value: String(item.quantity) });

  // 합계 필드 (행 형태)
  const totalFields: { key: string; label: string; value: string; color?: string }[] = [];
  if (has("normal_total")) totalFields.push({ key: "normal_total", label: "정상합계", value: formatWon(normalTotal) + "원" });
  if (has("discount_total")) totalFields.push({ key: "discount_total", label: "할인합계", value: formatWon(discountTotal) + "원", color: "var(--action)" });
  if (has("min_price_total")) totalFields.push({ key: "min_price_total", label: "최저합계", value: formatWon(minPriceTotal) + "원" });
  if (has("retail_normal_total")) totalFields.push({ key: "retail_normal_total", label: "정상소비자", value: formatWon(retailNormalTotal) + "원" });
  if (has("retail_discount_total")) totalFields.push({ key: "retail_discount_total", label: "할인소비자", value: formatWon(retailDiscountTotal) + "원", color: "var(--action)" });

  return (
    <div
      onClick={onOpen}
      style={{
        padding: 14,
        background: "var(--gray-50)",
        borderRadius: 12,
        border: "1px solid var(--border-default)",
        cursor: "pointer",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 6,
          right: 8,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <MoveBtn onClick={onMoveUp} disabled={isFirst}>▲</MoveBtn>
        <MoveBtn onClick={onMoveDown} disabled={isLast}>▼</MoveBtn>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{
            background: "none", border: "none", color: "var(--gray-300)",
            fontSize: 18, cursor: "pointer", lineHeight: 1, padding: "0 2px",
          }}
        >×</button>
      </div>

      {/* 메타 행 — 품목코드 + 빈티지/국가 + 분류/브랜드/지역 (visibleCols 활성 시) */}
      <div style={{ fontSize: 11, color: "var(--neutral-200)", marginBottom: 4 }}>
        #{index + 1}
        {has("item_code") !== false && ` ${item.item_code}`}
        {has("vintage") && item.vintage && ` · ${item.vintage}`}
        {has("country") && item.country && ` · ${item.country}`}
        {has("brand") && item.brand && ` · ${item.brand}`}
        {has("region") && item.region && ` · ${item.region}`}
      </div>

      {/* 제목 — 한글명 / 상품명 */}
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, paddingRight: 64 }}>
        {item.korean_name || item.product_name}
      </div>

      {/* 영문명 (활성 시) */}
      {has("english_name") && item.english_name && (
        <div style={{ fontSize: 12, color: "var(--neutral-400)", marginBottom: 4, fontStyle: "italic" }}>
          {item.english_name}
        </div>
      )}

      {/* 스펙 (활성 시) */}
      {has("spec") && item.spec && (
        <div style={{ fontSize: 12, color: "var(--neutral-400)", marginBottom: 6 }}>
          {item.spec}
        </div>
      )}

      {/* 이미지 (활성 시) */}
      {has("image_url") && item.image_url && (
        <a
          href={item.image_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ display: "inline-block", marginBottom: 6 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.image_url}
            alt={item.product_name || ""}
            style={{
              width: 56, height: 56, objectFit: "contain",
              background: "#fff", borderRadius: 4,
              border: "1px solid var(--border-subtle)",
            }}
          />
        </a>
      )}

      {/* 가격/수치 그리드 */}
      {valueFields.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8, marginTop: 6 }}>
          {valueFields.map((f) => (
            <div key={f.key}>
              <div style={{ fontSize: 10, color: "var(--neutral-200)" }}>{f.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: f.color || "var(--neutral-700)", fontVariantNumeric: "tabular-nums" }}>{f.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* 합계 행 */}
      {totalFields.length > 0 && (
        <div
          style={{
            marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border-default)",
            display: "flex", flexWrap: "wrap", gap: 10, fontSize: 12,
          }}
        >
          {totalFields.map((f) => (
            <span key={f.key} style={{ color: f.color || "var(--neutral-400)", fontWeight: f.color ? 600 : 400 }}>
              {f.label} {f.value}
            </span>
          ))}
        </div>
      )}

      {/* 비고 (활성 시) */}
      {has("note") && item.note && (
        <div style={{ marginTop: 6, fontSize: 12, color: "var(--neutral-200)" }}>비고: {item.note}</div>
      )}
    </div>
  );
}

function MoveBtn({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick();
      }}
      disabled={disabled}
      style={{
        background: "none", border: "none", padding: "2px 4px",
        color: disabled ? "var(--gray-300)" : "var(--neutral-200)", fontSize: 14,
        cursor: disabled ? "default" : "pointer", lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}
