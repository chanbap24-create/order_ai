import { CONFIDENCE_THRESHOLDS, ORDER_COLORS } from "../constants";

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
