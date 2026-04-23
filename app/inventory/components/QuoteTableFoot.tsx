"use client";

import { formatWon } from "../lib/format";
import type { QuoteColumnConfig } from "../types";
import { qTdStyle } from "./sharedStyles";

type Props = {
  visibleQuoteCols: QuoteColumnConfig[];
  totalQty: number;
  totalNormal: number;
  totalDiscount: number;
  totalRetailNormal: number;
  totalRetailDiscount: number;
};

/** 견적 테이블 합계 행 — 각 computed 컬럼에 총계 표시 */
export function QuoteTableFoot({
  visibleQuoteCols,
  totalQty,
  totalNormal,
  totalDiscount,
  totalRetailNormal,
  totalRetailDiscount,
}: Props) {
  return (
    <tfoot>
      <tr style={{ background: "#FFF2CC", fontWeight: 700 }}>
        <td style={{ ...qTdStyle, textAlign: "center" }}></td>
        {visibleQuoteCols.map((col) => {
          let content = "";
          if (col.key === "product_name") content = "합계";
          else if (col.key === "quantity") content = String(totalQty);
          else if (col.key === "normal_total") content = formatWon(totalNormal);
          else if (col.key === "discount_total") content = formatWon(totalDiscount);
          else if (col.key === "retail_normal_total")
            content = formatWon(totalRetailNormal);
          else if (col.key === "retail_discount_total")
            content = formatWon(totalRetailDiscount);
          const align: "left" | "right" | "center" =
            col.type === "currency" || col.type === "computed"
              ? "right"
              : col.type === "number"
                ? "center"
                : "left";
          return (
            <td
              key={col.key}
              style={{ ...qTdStyle, textAlign: align, fontWeight: 700 }}
            >
              {content}
            </td>
          );
        })}
        <td style={qTdStyle}></td>
      </tr>
    </tfoot>
  );
}
