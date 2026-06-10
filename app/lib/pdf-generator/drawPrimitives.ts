import { i, C } from "./theme";

export function drawLine(doc: PDFKit.PDFDocument, x: number, y: number, w: number, color: string, widthPt: number = 0.75) {
  doc.save()
    .moveTo(i(x), i(y))
    .lineTo(i(x + w), i(y))
    .lineWidth(widthPt)
    .strokeColor(color)
    .stroke()
    .restore();
}

export function drawRect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, fillColor: string) {
  doc.save().rect(i(x), i(y), i(w), i(h)).fill(fillColor).restore();
}

export function drawRoundedRect(
  doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number,
  fillColor: string, borderColor?: string, _borderWidth: number = 0.5, radius: number = 3,
) {
  doc.save();
  doc.roundedRect(i(x), i(y), i(w), i(h), radius);
  if (borderColor) {
    doc.fillAndStroke(fillColor, borderColor);
  } else {
    doc.fill(fillColor);
  }
  doc.restore();
}

export function drawLabelBadge(
  doc: PDFKit.PDFDocument, text: string, x: number, y: number, w: number, h: number = 0.22,
  fontBold: string,
  style: "outline" | "solid" = "outline",
) {
  // outline: 쉐이드 없이 테두리만 (PPT addLabelBadge와 동일 스타일)
  if (style === "outline") {
    drawRoundedRect(doc, x, y, w, h, C.WHITE, C.BURGUNDY, 0.75);
  } else {
    drawRoundedRect(doc, x, y, w, h, C.BURGUNDY);
  }
  doc.save()
    .font(fontBold)
    .fontSize(8.5)
    .fillColor(style === "outline" ? C.BURGUNDY_DARK : C.TEXT_ON_DARK);
  const textY = i(y) + (i(h) - 8.5) / 2;
  doc.text(text, i(x), textY, { width: i(w), align: "center" })
    .restore();
}
