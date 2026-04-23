"use client";

import { ORDER_FONT } from "../constants";
import { fmtShort } from "../lib/format";
import { getSelected } from "../lib/priceCalc";
import { getUnit } from "../lib/unitRules";
import type { DeliveryDateInfo, FridayChoice, OrderLine, OrderTab } from "../types";
import { DeliveryDatePanel } from "./DeliveryDatePanel";
import { DeliveryNotesPanel } from "./DeliveryNotesPanel";

type Props = {
  tab: OrderTab;
  headerTitle: string;
  orderLines: OrderLine[];
  totalAmount: number;
  // 배송일
  showDeliveryDate: boolean;
  setShowDeliveryDate: (fn: (v: boolean) => boolean) => void;
  deliveryInfo: DeliveryDateInfo;
  fridayChoice: FridayChoice;
  setFridayChoice: (v: FridayChoice) => void;
  customDate: string;
  setCustomDate: (v: string) => void;
  finalDeliveryLabel: string;
  // 특이사항
  showDeliveryNotes: boolean;
  setShowDeliveryNotes: (fn: (v: boolean) => boolean) => void;
  deliveryNotes: string;
  setDeliveryNotes: (v: string | ((p: string) => string)) => void;
};

/** 다크 그라디언트 결과 헤더 — 건수/수량/총액 + 배송일 + 특이사항 */
export function SummaryHeaderCard(p: Props) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #1a1a2e 0%, #2d1a2e 40%, #3a1520 100%)",
        borderRadius: 14,
        padding: "18px 20px",
        color: "#fff",
        marginBottom: 16,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <GrainTexture />
      <RadialGlow />

      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            fontFamily: ORDER_FONT.display,
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          {p.headerTitle} 분석 결과
        </div>
        <div
          style={{
            fontSize: 12,
            opacity: 0.55,
            marginTop: 3,
            fontWeight: 500,
            letterSpacing: "0.02em",
          }}
        >
          {p.orderLines.length}개 품목 · {describeQuantities(p.tab, p.orderLines)}
          {p.totalAmount > 0 && ` · ${fmtShort(p.totalAmount)}`}
        </div>

        <DeliveryDatePanel
          open={p.showDeliveryDate}
          toggleOpen={() => p.setShowDeliveryDate((v) => !v)}
          info={p.deliveryInfo}
          fridayChoice={p.fridayChoice}
          setFridayChoice={p.setFridayChoice}
          customDate={p.customDate}
          setCustomDate={p.setCustomDate}
          finalLabel={p.finalDeliveryLabel}
        />

        <DeliveryNotesPanel
          open={p.showDeliveryNotes}
          toggleOpen={() => p.setShowDeliveryNotes((v) => !v)}
          notes={p.deliveryNotes}
          setNotes={p.setDeliveryNotes}
        />
      </div>
    </div>
  );
}

/** CDV는 "N병", DL은 잔/개 내역 */
function describeQuantities(tab: OrderTab, lines: OrderLine[]): string {
  if (tab !== "DL") {
    return `${lines.reduce((s, ol) => s + ol.quantity, 0)}병`;
  }
  let glasses = 0;
  let pieces = 0;
  lines.forEach((ol) => {
    const sel = getSelected(ol);
    const u = getUnit(tab, sel?.item_no, sel?.item_name);
    if (u === "잔") glasses += ol.quantity;
    else pieces += ol.quantity;
  });
  const parts: string[] = [];
  if (glasses > 0) parts.push(`${glasses}잔`);
  if (pieces > 0) parts.push(`${pieces}개`);
  return parts.join(" + ") || "0개";
}

function GrainTexture() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: 0.03,
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        pointerEvents: "none",
      }}
    />
  );
}

function RadialGlow() {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: "60%",
        height: "100%",
        background:
          "radial-gradient(ellipse at 80% 30%, rgba(90,21,21,0.3) 0%, transparent 70%)",
        pointerEvents: "none",
      }}
    />
  );
}
