import type PptxGenJS from "pptxgenjs";
import { C, FONT_EN, FONT_MAIN, type Slide, type SlideData } from "../theme";
import { addLine, addLabelBadge } from "../addPrimitives";
import { capSentences, cleanField } from "@/app/lib/wineNoteText";

const BX = 2.2;          // 라벨/본문 좌측
const TW = 5.05;         // 본문 폭
const BODY_TOP = 1.95;   // 본문 시작 y
const BODY_BOTTOM = 8.72; // 본문 하한(푸터/어워즈 위)

/**
 * 텍스트 높이(인치) 추정 — PPT는 측정 API가 없어 추정.
 * 글자폭은 한글+라틴 혼합 평균 ≈ 0.9·fs, 줄높이 ≈ 1.3·fs 로 보정(과대추정 시 빈틈 발생).
 */
function estH(text: string, wIn: number, fs: number, lineMul = 1.32): number {
  const cpl = Math.max(6, (wIn * 72) / (fs * 0.92));
  const lines = Math.max(1, Math.ceil((text || "").length / cpl));
  return (lines * fs * lineMul) / 72;
}

/**
 * 본문(지역/품종/빈티지/와이너리/양조/글라스/테이스팅)을
 * 내용 높이만큼 흐르게 배치하고, 한 페이지에 맞도록 폰트/간격을 자동 스케일.
 */
export function renderInfo(slide: Slide, data: SlideData) {
  const winery = capSentences(cleanField(data.wineryDescription), 4, 300);
  const potential = capSentences(cleanField(data.agingPotential), 4, 280);
  const countryEn = data.countryEn || data.country || "";
  const regionText = data.region ? `${countryEn}, ${data.region}` : countryEn || "-";
  let winemakingText = cleanField(data.winemaking) || "-";
  if (data.alcoholPercentage) winemakingText += `\nAlc. ${data.alcoholPercentage}`;
  const tItems: [string, string][] = ([
    ["Color", cleanField(data.colorNote)], ["Nose", cleanField(data.noseNote)],
    ["Palate", cleanField(data.palateNote)], ["Potential", potential],
  ].filter(([, v]) => v) as [string, string][]);

  // body(s, draw): draw=false 면 높이만 누적(슬라이드에 추가 X), 반환=최종 y
  const body = (s: number, draw: boolean): number => {
    let y = BODY_TOP;
    const fs = (b: number) => b * s;
    const gap = (g: number) => g * (0.5 + 0.5 * s);

    const inlineRow = (label: string, value: string, labelW: number) => {
      const vx = BX + labelW + 0.12, vw = TW - labelW - 0.12;
      const h = estH(value, vw, fs(9.5), 1.25);
      if (draw) {
        addLabelBadge(slide, label, BX, y, labelW, 0.22);
        slide.addText(value, {
          x: vx, y, w: vw, h: Math.max(0.24, h),
          fontSize: fs(9.5), fontFace: FONT_MAIN, color: C.TEXT_PRIMARY,
          valign: "middle", wrap: true,
        });
      }
      y += Math.max(0.26, h) + gap(0.08);
      if (draw) addLine(slide, BX, y - 0.05, TW, C.DIVIDER_LIGHT, 0.4);
      y += gap(0.07);
    };

    const blockRow = (label: string, labelW: number, text: string, baseFs: number) => {
      if (draw) addLabelBadge(slide, label, BX, y, labelW, 0.22);
      y += gap(0.30);
      const h = estH(text, TW, fs(baseFs));
      if (draw) {
        slide.addText(text, {
          x: BX, y, w: TW, h,
          fontSize: fs(baseFs), fontFace: FONT_MAIN, color: C.TEXT_PRIMARY,
          lineSpacingMultiple: 1.3, valign: "top", wrap: true,
        });
      }
      y += h + gap(0.2);
    };

    inlineRow("지역", regionText, 0.55);
    inlineRow("품종", data.grapeVarieties || "-", 0.55);

    // 빈티지
    if (draw) {
      addLabelBadge(slide, "빈티지", BX, y, 0.65, 0.22);
      slide.addText(data.vintage || "-", {
        x: 2.9, y: y - 0.04, w: 0.9, h: 0.3,
        fontSize: fs(14), fontFace: FONT_EN, color: C.BURGUNDY, bold: true, valign: "middle",
      });
    }
    const vn = capSentences(cleanField(data.vintageNote), 1, 95);
    if (vn) {
      const vnW = TW - 1.6;
      const h = estH(vn, vnW, fs(8), 1.2);
      if (draw) {
        slide.addText(vn, {
          x: 3.75, y, w: vnW, h: Math.max(0.24, h),
          fontSize: fs(8), fontFace: FONT_MAIN, color: C.TEXT_SECONDARY, valign: "middle", wrap: true,
        });
      }
      y += Math.max(0.26, h) + gap(0.08);
    } else {
      y += 0.26 + gap(0.08);
    }
    if (draw) addLine(slide, BX, y - 0.05, TW, C.DIVIDER_LIGHT, 0.4);
    y += gap(0.07);

    if (winery) blockRow("와이너리", 0.72, winery, 8.7);
    blockRow("양조", 0.55, winemakingText, 9.6);

    // ── 테이스팅 노트 카드 ──
    if (tItems.length > 0) {
      y += 0.22; // 양조↔카드 최소 간격(추정 오차로 붙는 것 방지)
      const innerW = TW - 0.4;
      const labelLine = (fs(9) * 1.5) / 72; // 라벨 줄(— COLOR)은 값과 별도 줄
      let contentH = gap(0.46);             // 타이틀(TASTING NOTE) 영역
      for (const [, v] of tItems) contentH += labelLine + estH(v, innerW, fs(9.8)) + gap(0.14);
      const cardH = contentH + gap(0.2);
      if (draw) {
        slide.addShape("roundRect", { x: BX, y, w: TW, h: cardH, fill: { color: C.BG_WARM_GRAY }, rectRadius: 0.06, line: { width: 0 } });
        slide.addShape("rect", { x: BX, y, w: 0.06, h: cardH, fill: { color: C.GOLD }, line: { width: 0 } });
        addLabelBadge(slide, "TASTING NOTE", BX + 0.15, y + 0.08, 1.32, 0.22, "solid");

        const runs: PptxGenJS.TextProps[] = [];
        let first = true;
        for (const [label, v] of tItems) {
          if (!first) runs.push({ text: "\n", options: { fontSize: fs(4), breakLine: true } });
          runs.push({ text: `— ${label.toUpperCase()}`, options: { fontSize: fs(9), fontFace: FONT_EN, color: C.GOLD, bold: true, breakLine: true, charSpacing: 2 } });
          runs.push({ text: v, options: { fontSize: fs(9.8), fontFace: FONT_MAIN, color: C.TEXT_PRIMARY, lineSpacingMultiple: 1.25, breakLine: true } });
          first = false;
        }
        slide.addText(runs, { x: BX + 0.22, y: y + gap(0.4), w: innerW, h: cardH - gap(0.5), valign: "top", wrap: true, margin: [0, 4, 0, 4] });
      }
      y += cardH + gap(0.16);
    }

    return y;
  };

  // fit-to-one-page
  const avail = BODY_BOTTOM - BODY_TOP;
  const used1 = body(1.0, false) - BODY_TOP;
  let s = Math.sqrt(avail / used1);
  s = Math.max(0.58, Math.min(1.28, s));
  const used2 = body(s, false) - BODY_TOP;
  if (used2 > avail) s = Math.max(0.52, s * (avail / used2));
  body(s, true);
}
