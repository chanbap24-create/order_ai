import type { ReactNode } from "react";
import { getItemCategory } from "../constants/categories";
import { formatNumber, formatPercent, formatPrice, formatWon } from "./format";
import { calcDiscountedPrice } from "./priceCalc";
import type {
  InventoryItem,
  InvColumnKey,
  QuoteColumnConfig,
  QuoteColumnKey,
  QuoteItem,
} from "../types";
import type { WineProfile } from "../hooks/useQuoteItems";

/** 재고 테이블 셀 렌더링 */
export function renderInvCellValue(
  item: InventoryItem,
  key: InvColumnKey,
): ReactNode {
  switch (key) {
    case "item_no":
      return item.item_no;
    case "item_name":
      return item.item_name;
    case "category":
      return getItemCategory(item.item_no);
    case "brand":
    case "importer":
    case "volume_ml":
    case "barcode":
      return item[key] || "-";
    case "supply_price":
    case "discount_price":
    case "wholesale_price":
    case "retail_price":
    case "min_price":
      return formatPrice(item[key]);
    case "total_stock":
      return (
        <span
          style={{
            color: (item.total_stock ?? 0) > 0 ? "var(--color-success)" : "var(--color-error)",
            fontWeight: 700,
          }}
        >
          {formatNumber(item.total_stock ?? 0)}
        </span>
      );
    case "available_stock":
      return (
        <span
          style={{
            color: (item.available_stock ?? 0) > 0 ? "var(--color-success)" : "var(--color-error)",
            fontWeight: 700,
          }}
        >
          {formatNumber(item.available_stock ?? 0)}
        </span>
      );
    case "stock_excl_available":
    case "pending_shipment":
    case "bonded_warehouse":
    case "yongma_logistics":
    case "kctc":
    case "bonded_kctc":
    case "yongma_reserve":
    case "yongma_marketing":
    case "yongma_sales1":
    case "yongma_sales2":
    case "anseong_warehouse":
    case "gig_warehouse":
    case "gig_marketing":
    case "gig_sales1":
    case "incoming_stock":
    case "sales_30days":
    case "avg_sales_90d":
    case "avg_sales_365d":
      return formatNumber(item[key] ?? 0);
    case "vintage":
      return item.vintage || "-";
    case "alcohol_content":
      return item.alcohol_content || "-";
    case "country":
      return item.country || "-";
    default:
      return "-";
  }
}

/** 견적 테이블 셀의 raw value (편집용) */
export function getQuoteCellValue(
  item: QuoteItem,
  key: QuoteColumnKey,
  wineProfiles: Record<string, WineProfile>,
): string | number {
  switch (key) {
    case "discounted_price":
      return calcDiscountedPrice(
        item.supply_price,
        item.discount_rate,
        item.discounted_price,
      );
    case "retail_discounted_price":
      return calcDiscountedPrice(item.retail_price || 0, item.discount_rate);
    case "normal_total":
      return item.supply_price * item.quantity;
    case "discount_total":
      return (
        calcDiscountedPrice(item.supply_price, item.discount_rate, item.discounted_price) *
        item.quantity
      );
    case "min_price_total":
      return (item.min_price || 0) * item.quantity;
    case "retail_normal_total":
      return (item.retail_price || 0) * item.quantity;
    case "retail_discount_total":
      return (
        calcDiscountedPrice(item.retail_price || 0, item.discount_rate) * item.quantity
      );
    case "discount_rate":
      return item.discount_rate;
    case "category":
      return getItemCategory(item.item_code);
    case "grape_varieties":
      return wineProfiles[item.item_code]?.grape_varieties || "";
    default:
      return (item as any)[key] ?? "";
  }
}

/** 견적 셀의 포맷된 표시용 문자열 */
export function formatQuoteCellValue(
  item: QuoteItem,
  col: QuoteColumnConfig,
  wineProfiles: Record<string, WineProfile>,
): string {
  const val = getQuoteCellValue(item, col.key, wineProfiles);
  if (col.type === "currency" || col.type === "computed") return formatWon(Number(val));
  if (col.type === "percent") return formatPercent(Number(val));
  return String(val);
}
