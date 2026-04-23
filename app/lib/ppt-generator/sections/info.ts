import { C, FONT_EN, FONT_MAIN, type Slide, type SlideData } from "../theme";
import { addLine, addLabelBadge } from "../addPrimitives";

const SEC_X = 2.35;     // 뱃지 시작
const VAL_X = 2.95;     // 값 시작
const SEC_W = 4.75;     // 값 넓이
const SEC_Y0 = 1.97;    // 첫 섹션 Y
const SEC_GAP = 0.45;   // 섹션 간격
const ROW_H = 0.22;
const DIV_OFFSET = 0.32;

/**
 * 지역 / 품종 / 빈티지 / 양조 정보 블록 (등간격 0.45 리듬).
 */
export function renderInfo(slide: Slide, data: SlideData) {
  // ── 지역 ──
  addLabelBadge(slide, "지역", SEC_X, SEC_Y0, 0.62, ROW_H);
  const countryEn = data.countryEn || data.country || "";
  const regionText = data.region
    ? `${countryEn}, ${data.region}`
    : countryEn || "-";
  slide.addText(regionText, {
    x: VAL_X, y: SEC_Y0, w: SEC_W, h: ROW_H,
    fontSize: 9.5, fontFace: FONT_MAIN,
    color: C.TEXT_PRIMARY, autoFit: true, valign: "middle",
  });
  addLine(slide, SEC_X, SEC_Y0 + DIV_OFFSET, 4.9, C.DIVIDER_LIGHT, 0.4);

  // ── 품종 ──
  const Y_GRAPE = SEC_Y0 + SEC_GAP;
  addLabelBadge(slide, "품종", SEC_X, Y_GRAPE, 0.62, ROW_H);
  slide.addText(data.grapeVarieties || "-", {
    x: VAL_X, y: Y_GRAPE, w: SEC_W, h: ROW_H,
    fontSize: 9.5, fontFace: FONT_MAIN,
    color: C.TEXT_PRIMARY, autoFit: true, valign: "middle",
  });
  addLine(slide, SEC_X, Y_GRAPE + DIV_OFFSET, 4.9, C.DIVIDER_LIGHT, 0.4);

  // ── 빈티지 ──
  const Y_VINT = SEC_Y0 + SEC_GAP * 2;
  addLabelBadge(slide, "빈티지", SEC_X, Y_VINT, 0.62, ROW_H);
  const vintage = data.vintage || "-";
  slide.addText(vintage, {
    x: 3.05, y: Y_VINT, w: 0.7, h: ROW_H,
    fontSize: 14, fontFace: FONT_EN,
    color: C.BURGUNDY, bold: true, valign: "middle",
  });
  addLine(slide, SEC_X, Y_VINT + DIV_OFFSET, 4.9, C.DIVIDER_LIGHT, 0.4);

  // ── 양조 ──
  const Y_WINE = SEC_Y0 + SEC_GAP * 3;
  addLabelBadge(slide, "양조", SEC_X, Y_WINE, 0.62, ROW_H);
  let winemakingText = data.winemaking || "-";
  if (data.alcoholPercentage) {
    winemakingText += `  |  Alc. ${data.alcoholPercentage}`;
  }
  slide.addText(winemakingText, {
    x: SEC_X, y: Y_WINE + 0.26, w: 4.85, h: 0.9,
    fontSize: 9, fontFace: FONT_MAIN,
    color: C.TEXT_PRIMARY,
    lineSpacingMultiple: 1.3, wrap: true, autoFit: true,
  });
}
