import { i, C, PAGE_W, PAGE_H, blendWithWhite, type SlideData } from "./theme";
import { drawLine, drawRect, drawRoundedRect, drawLabelBadge } from "./drawPrimitives";
import { LOGO_CAVEDEVIN_BASE64, ICON_AWARD_BASE64 } from "@/app/lib/pptAssets";
import { logger } from "@/app/lib/logger";

export function renderPage(
  doc: PDFKit.PDFDocument,
  data: SlideData,
  fontRegular: string,
  fontBold: string,
  fontEn: string,
) {
  // 배경: 흰색
  drawRect(doc, 0, 0, PAGE_W, PAGE_H, C.WHITE);

  // 1. 좌측 병 영역 배경
  const bottleAreaColor = blendWithWhite(C.BG_BOTTLE_AREA, 0.6);
  drawRect(doc, 0, 0.90, 2.10, 8.10, bottleAreaColor);

  // 2. 로고
  try {
    const logoBuffer = Buffer.from(LOGO_CAVEDEVIN_BASE64, "base64");
    doc.image(logoBuffer, i(0.20), i(0.20), { width: i(1.49), height: i(0.57) });
  } catch { /* ignore */ }

  // 3. 와이너리 태그라인
  const wineryDesc = data.wineryDescription || "";
  if (wineryDesc) {
    let tagline = wineryDesc.split(".")[0].trim();
    if (!tagline) tagline = wineryDesc.split("。")[0].trim();
    if (tagline) {
      doc.save()
        .font(fontRegular)
        .fontSize(9)
        .fillColor(C.TEXT_MUTED)
        .text(tagline, i(1.76), i(0.22), { width: i(5.20) })
        .restore();
    }
  }

  // 4-5. 헤더 구분선
  drawLine(doc, 0.20, 0.84, 7.10, C.BURGUNDY, 1.0);
  drawLine(doc, 0.20, 0.87, 7.10, C.GOLD_LIGHT, 0.75);

  // 6. 와인명 카드 배경
  const wineCardBg = blendWithWhite(C.BURGUNDY_LIGHT, 0.8);
  drawRoundedRect(doc, 2.05, 0.97, 5.20, 0.76, wineCardBg, C.CARD_BORDER);

  // 7. 와인명
  const nameKrClean = data.nameKr.replace(/^[A-Za-z]{2}\s+/, "");
  doc.save()
    .font(fontBold)
    .fontSize(14.5)
    .fillColor(C.BURGUNDY_DARK)
    .text(nameKrClean, i(2.20), i(1.02), { width: i(4.90) })
    .restore();

  if (data.nameEn) {
    doc.save()
      .font(fontEn)
      .fontSize(10.5)
      .fillColor(C.TEXT_SECONDARY)
      .text(data.nameEn, i(2.20), i(1.40), { width: i(4.90) })
      .restore();
  }

  // 8. 와인명 하단 구분선
  drawLine(doc, 2.20, 1.82, 4.90, C.DIVIDER, 0.75);

  // 9. 지역
  drawLabelBadge(doc, "지역", 2.12, 1.97, 0.55, 0.22, fontBold);
  const countryEn = data.countryEn || data.country || "";
  const regionText = data.region ? `${countryEn}, ${data.region}` : countryEn || "-";
  doc.save().font(fontRegular).fontSize(9.5).fillColor(C.TEXT_PRIMARY)
    .text(regionText, i(2.75), i(1.99), { width: i(4.40) }).restore();

  drawLine(doc, 2.20, 2.35, 4.90, C.DIVIDER_LIGHT, 0.5);

  // 10. 품종
  drawLabelBadge(doc, "품종", 2.12, 2.42, 0.55, 0.22, fontBold);
  doc.save().font(fontRegular).fontSize(9.5).fillColor(C.TEXT_PRIMARY)
    .text(data.grapeVarieties || "-", i(2.75), i(2.44), { width: i(4.40) }).restore();

  // 11. 빈티지
  drawLabelBadge(doc, "빈티지", 2.12, 3.02, 0.65, 0.22, fontBold);
  doc.save().font(fontBold).fontSize(13).fillColor(C.BURGUNDY)
    .text(data.vintage || "-", i(2.85), i(3.02), { width: i(0.75) }).restore();

  if (data.vintageNote) {
    doc.save().font(fontRegular).fontSize(8).fillColor(C.TEXT_SECONDARY)
      .text(data.vintageNote, i(3.65), i(3.04), { width: i(3.50) }).restore();
  }

  // 12. 양조
  drawLabelBadge(doc, "양조", 2.12, 3.62, 0.55, 0.22, fontBold);
  let winemakingText = data.winemaking || "-";
  if (data.alcoholPercentage) winemakingText += `\n알코올: ${data.alcoholPercentage}`;
  doc.save().font(fontRegular).fontSize(9).fillColor(C.TEXT_PRIMARY)
    .text(winemakingText, i(2.15), i(3.92), { width: i(5.00), lineGap: 3 }).restore();

  // 12.5 글라스 페어링 + 서빙온도 (양조와 테이스팅 노트 사이 여백 활용)
  let infoY = 4.72;
  if (data.glassPairing) {
    drawLabelBadge(doc, "글라스", 2.12, infoY, 0.55, 0.22, fontBold);
    doc.save().font(fontRegular).fontSize(9).fillColor(C.TEXT_PRIMARY)
      .text(data.glassPairing, i(2.75), i(infoY + 0.02), { width: i(4.40) }).restore();
    infoY += 0.30;
  }
  if (data.servingTemp) {
    drawLabelBadge(doc, "서빙온도", 2.12, infoY, 0.72, 0.22, fontBold);
    doc.save().font(fontRegular).fontSize(9).fillColor(C.TEXT_PRIMARY)
      .text(data.servingTemp, i(2.92), i(infoY + 0.02), { width: i(4.20) }).restore();
  }

  // 13. 테이스팅 노트 카드
  const tastingBg = blendWithWhite(C.BURGUNDY_LIGHT, 0.7);
  drawRoundedRect(doc, 2.05, 5.30, 5.20, 2.72, tastingBg, C.CARD_BORDER);
  drawLabelBadge(doc, "TASTING NOTE", 2.12, 5.35, 1.32, 0.22, fontBold);

  // 14. 테이스팅 노트 내용
  const tastingItems: [string, string][] = [
    ["Color", data.colorNote || ""],
    ["Nose", data.noseNote || ""],
    ["Palate", data.palateNote || ""],
    ["Potential", data.agingPotential || ""],
  ];

  let noteY = i(5.65);
  for (const [label, value] of tastingItems) {
    if (!value) continue;
    doc.save().font(fontEn).fontSize(8.5).fillColor(C.BURGUNDY)
      .text(label.toUpperCase(), i(2.15), noteY, { width: i(5.00), characterSpacing: 1 }).restore();
    noteY += 11;
    doc.save().font(fontRegular).fontSize(9).fillColor(C.TEXT_PRIMARY)
      .text(value, i(2.15), noteY, { width: i(5.00), lineGap: 2 }).restore();
    noteY += doc.heightOfString(value, { width: i(5.00) }) + 8;
  }

  if (tastingItems.every(([, v]) => !v)) {
    doc.save().font(fontRegular).fontSize(9).fillColor(C.TEXT_MUTED)
      .text("-", i(2.15), i(5.65), { width: i(5.00) }).restore();
  }

  // 15. 푸드 페어링
  drawLabelBadge(doc, "푸드 페어링", 2.12, 8.18, 0.95, 0.22, fontBold);
  doc.save().font(fontRegular).fontSize(9).fillColor(C.TEXT_PRIMARY)
    .text(data.foodPairing || "-", i(2.15), i(8.44), { width: i(5.00), lineGap: 3 }).restore();

  // 16. 수상내역
  drawLine(doc, 0.15, 9.04, 7.20, C.GOLD_LIGHT, 0.5);

  const awards = data.awards || "";
  if (awards && awards !== "N/A") {
    try {
      const iconBuffer = Buffer.from(ICON_AWARD_BASE64, "base64");
      doc.image(iconBuffer, i(0.25), i(9.08), { width: i(0.22), height: i(0.28) });
    } catch { /* ignore */ }

    doc.save().font(fontBold).fontSize(8).fillColor(C.GOLD)
      .text("AWARDS  ", i(0.52), i(9.12), { continued: true })
      .font(fontRegular).fontSize(9).fillColor(C.TEXT_PRIMARY)
      .text(awards)
      .restore();
  }

  // 17. 푸터
  drawLine(doc, 0.20, 9.52, 7.10, C.BURGUNDY, 2.0);
  drawLine(doc, 0.20, 9.55, 7.10, C.GOLD_LIGHT, 0.75);

  try {
    const logoBuffer = Buffer.from(LOGO_CAVEDEVIN_BASE64, "base64");
    doc.image(logoBuffer, i(0.09), i(9.68), { width: i(0.95), height: i(0.25) });
  } catch { /* ignore */ }

  doc.save().font(fontRegular).fontSize(7).fillColor(C.TEXT_MUTED)
    .text("T. 02-786-3136  |  www.cavedevin.com", i(1.12), i(9.72), {
      width: i(2.76), align: "right",
    }).restore();

  // 18. 병 이미지 (Vivino 이미지면 하단 워터마크 띠를 크롭)
  if (data.bottleImageBase64 && data.bottleImageMimeType) {
    try {
      const imgBuffer = Buffer.from(data.bottleImageBase64, "base64");
      const boxX = i(0.25), boxY = i(2.00), boxW = i(1.60), boxH = i(5.50);
      const img = doc.openImage(imgBuffer);
      // 워터마크 위치별 크롭 (우: wine-searcher 우상단, 하단: Vivino). 깨끗한 이미지는 0.
      const rightFrac = data.bottleCropRight ? 0.12 : 0;
      const bottomFrac = data.bottleCropBottom ? 0.07 : 0;
      const srcVisW = img.width * (1 - rightFrac);     // 좌측부터 보일 폭(원본 px)
      const srcVisH = img.height * (1 - bottomFrac);   // 위부터 보일 높이(원본 px)
      const scale = Math.min(boxW / srcVisW, boxH / srcVisH);
      const visW = srcVisW * scale;
      const visH = srcVisH * scale;
      const drawX = boxX + (boxW - visW) / 2;
      const drawY = boxY + (boxH - visH) / 2;
      // 보이는 영역(좌상단)만 클립 → 우측/하단 워터마크는 클립 밖으로 잘림.
      doc.save().rect(drawX, drawY, visW, visH).clip();
      doc.image(imgBuffer, drawX, drawY, {
        width: img.width * scale,
        height: img.height * scale,
      });
      doc.restore();
    } catch (e) {
      logger.warn(`[PDF] Failed to add bottle image: ${e}`);
    }
  }
}
