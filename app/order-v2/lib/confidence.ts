import { CONFIDENCE_THRESHOLDS, ORDER_COLORS } from "../constants";
import type { OrderLine } from "../types";

/** 라인이 애매한지 — 후보 없음/미선택, confidence<0.7, ⚠ 검수경고 중 하나 */
export function isLineShaky(ol: OrderLine): boolean {
  if (ol.candidates.length === 0 || ol.selectedIdx < 0) return true;
  const sel = ol.candidates[ol.selectedIdx];
  if (sel && sel.confidence < 0.7) return true;
  return (ol.review_note || "").startsWith("⚠");
}

/** 모든 라인이 확실(불확정 0)한지 — 자동 복사 가능 여부 */
export function allLinesReady(lines: OrderLine[]): boolean {
  return lines.length > 0 && !lines.some(isLineShaky);
}

/** 신뢰도에 대응하는 색 */
export function confColor(c: number): string {
  if (c >= CONFIDENCE_THRESHOLDS.high) return ORDER_COLORS.confHigh;
  if (c >= CONFIDENCE_THRESHOLDS.mid) return ORDER_COLORS.confMid;
  if (c >= CONFIDENCE_THRESHOLDS.low) return ORDER_COLORS.confLow;
  return ORDER_COLORS.confNone;
}

/** 신뢰도에 대응하는 한글 라벨 */
export function confLabel(c: number): string {
  if (c >= CONFIDENCE_THRESHOLDS.high) return "확실";
  if (c >= CONFIDENCE_THRESHOLDS.mid) return "높음";
  if (c >= CONFIDENCE_THRESHOLDS.low) return "중간";
  return "불확실";
}
