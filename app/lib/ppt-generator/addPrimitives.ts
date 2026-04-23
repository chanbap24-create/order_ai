import { C, FONT_EN, FONT_MAIN, type Slide } from "./theme";

export function addLine(
  slide: Slide, x: number, y: number, w: number,
  color: string, widthPt: number = 0.75,
) {
  slide.addShape("line", {
    x, y, w, h: 0,
    line: { color, width: widthPt },
  });
}

export function addVLine(
  slide: Slide, x: number, yStart: number, yEnd: number,
  color: string, widthPt: number = 0.75,
) {
  slide.addShape("line", {
    x, y: yStart, w: 0,
    h: yEnd - yStart,
    line: { color, width: widthPt },
  });
}

export function addLabelBadge(
  slide: Slide, text: string,
  x: number, y: number, w: number,
  h: number = 0.22,
  style: "outline" | "solid" = "outline",
) {
  if (style === "solid") {
    slide.addShape("roundRect", {
      x, y, w, h,
      fill: { color: C.BURGUNDY },
      rectRadius: 0.04,
      line: { width: 0 },
    });
    slide.addText(text, {
      x, y, w, h,
      fontSize: 7.5,
      fontFace: FONT_EN,
      color: C.TEXT_ON_DARK,
      bold: true,
      align: "center",
      valign: "middle",
      charSpacing: 1.5,
    });
    return;
  }
  slide.addShape("roundRect", {
    x, y, w, h,
    fill: { color: C.BURGUNDY_LIGHT, transparency: 50 },
    rectRadius: 0.04,
    line: { color: C.BURGUNDY, width: 0.75 },
  });
  slide.addText(text, {
    x, y, w, h,
    fontSize: 7.5,
    fontFace: FONT_MAIN,
    color: C.BURGUNDY_DARK,
    bold: true,
    align: "center",
    valign: "middle",
  });
}
