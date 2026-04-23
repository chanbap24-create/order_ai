import type PptxGenJS from "pptxgenjs";
import { C, FONT_EN, FONT_MAIN, type Slide, type SlideData } from "../theme";
import { addLabelBadge } from "../addPrimitives";

const TN_Y = 4.5;
const TN_H = 4.4;

/**
 * TASTING NOTE 카드 (Color / Nose / Palate 분리 배치).
 */
export function renderTasting(slide: Slide, data: SlideData) {
  // 배경: 보더 없는 웜 그레이
  slide.addShape("roundRect", {
    x: 2.2, y: TN_Y, w: 5.05, h: TN_H,
    fill: { color: C.BG_WARM_GRAY },
    rectRadius: 0.06,
    line: { width: 0 },
  });

  // 좌측 세로 포인트 바 (골드)
  slide.addShape("rect", {
    x: 2.2, y: TN_Y, w: 0.06, h: TN_H,
    fill: { color: C.GOLD },
    line: { width: 0 },
  });

  // TASTING NOTE 타이틀 (solid 스타일)
  addLabelBadge(slide, "TASTING NOTE", 2.35, TN_Y + 0.07, 1.32, 0.22, "solid");

  const tastingItems: [string, string][] = [
    ["Color", data.colorNote || ""],
    ["Nose", data.noseNote || ""],
    ["Palate", data.palateNote || ""],
  ];

  const tastingRuns: PptxGenJS.TextProps[] = [];
  let isFirst = true;
  for (const [label, value] of tastingItems) {
    if (!value) continue;

    if (!isFirst) {
      tastingRuns.push({
        text: "\n",
        options: { fontSize: 5, breakLine: true },
      });
    }

    tastingRuns.push({
      text: `— ${label.toUpperCase()}`,
      options: {
        fontSize: 8, fontFace: FONT_EN,
        color: C.GOLD, bold: true,
        breakLine: !isFirst, charSpacing: 2,
      },
    });

    tastingRuns.push({
      text: `\n${value}`,
      options: {
        fontSize: 9, fontFace: FONT_MAIN,
        color: C.TEXT_PRIMARY, lineSpacingMultiple: 1.3,
      },
    });

    isFirst = false;
  }

  if (tastingRuns.length === 0) {
    tastingRuns.push({
      text: "-",
      options: { fontSize: 9, fontFace: FONT_MAIN, color: C.TEXT_MUTED },
    });
  }

  slide.addText(tastingRuns, {
    x: 2.45, y: TN_Y + 0.4, w: 4.65, h: TN_H - 0.5,
    valign: "top", wrap: true,
    margin: [0, 5, 0, 5],
    autoFit: true,
  });
}
