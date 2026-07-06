import { i, C, PAGE_W, PAGE_H, type SlideData } from "./theme";
import { drawLine, drawRect, drawRoundedRect, drawLabelBadge } from "./drawPrimitives";
import { LOGO_CAVEDEVIN_BASE64, ICON_AWARD_BASE64 } from "@/app/lib/pptAssets";
import { logger } from "@/app/lib/logger";
import { capSentences, extractWineryNameEn, stripCodePrefix, cleanField, capChars, cleanAwards } from "@/app/lib/wineNoteText";

/**
 * 적응형 단일 페이지 레이아웃.
 * - 각 섹션이 내용 높이만큼 차지(양조 안 잘림, 테이스팅 빈공간 없음).
 * - 전체 본문을 측정해 한 페이지에 맞도록 폰트/간격을 자동 스케일.
 *   내용 많으면 살짝 축소, 적으면 확대 → 항상 한 페이지로 균형 있게.
 */

const CX = 2.12;        // 라벨 badge x
const TX = 2.15;        // 본문 텍스트 x
const TW = 5.05;        // 본문 폭
const BODY_TOP = 1.92;  // 본문 시작 y
const BODY_BOTTOM = 8.95; // 본문 하한(푸터 위)
const LABEL_W = 0.72;   // 라벨 배지 통일 폭 (지역/품종/빈티지/와이너리/양조)

export function renderPage(
  doc: PDFKit.PDFDocument,
  data: SlideData,
  fontRegular: string,
  fontBold: string,
  fontEn: string,
) {
  const measure = (text: string, w: number, fs: number, font: string, lineGap = 2): number => {
    doc.font(font).fontSize(fs);
    return doc.heightOfString(text, { width: i(w), lineGap }) / 72;
  };
  const drawText = (
    text: string, x: number, y: number, w: number, fs: number,
    font: string, color: string, lineGap = 2, extra: PDFKit.Mixins.TextOptions = {},
  ) => {
    doc.save().font(font).fontSize(fs).fillColor(color)
      .text(text, i(x), i(y), { width: i(w), lineGap, ...extra }).restore();
  };

  // ── 정적 요소(스케일 무관) ──
  drawRect(doc, 0, 0, PAGE_W, PAGE_H, C.WHITE);
  // 좌측 병 영역: 흰색 배경(병 이미지가 누끼가 아니라 흰 박스 배경이어도 자연스럽게).
  drawRect(doc, 0, 0.90, 2.10, 8.10, C.WHITE);
  // (까브드뱅 로고는 푸터에만 — 헤더는 와이너리 로고/이름)
  drawLine(doc, 0.20, 0.84, 7.10, C.BURGUNDY, 1.0);
  drawLine(doc, 0.20, 0.87, 7.10, C.GOLD_LIGHT, 0.75);

  // 와인명: 배경 쉐이드 없이 텍스트만
  const nameKrClean = stripCodePrefix(data.nameKr);
  // 영문 풀네임은 상단 타이틀에 있으므로 카드엔 한글명만(중복 제거)
  drawText(nameKrClean, 2.20, 1.20, 4.90, 15, fontBold, C.BURGUNDY_DARK);

  // ── 헤더: 와이너리 로고(병과 중앙정렬) + 이름/원산지(우측 콘텐츠 시작점 정렬) ──
  {
    // 상단 타이틀 = 와인 영문명 전체(잘리지 않게). 지역 부제는 생략해 이름 공간 확보.
    const wName = stripCodePrefix(data.nameEn) || extractWineryNameEn(data.wineryDescription, data.nameEn);
    const hasLogo = !!(data.brandLogoBase64 && data.brandLogoW && data.brandLogoH);
    const BOTTLE_CENTER = 1.05; // 좌측 병 영역 중심 (병 박스 boxX 0.25 + boxW 1.6 / 2)
    const CONTENT_X = 2.05;     // 우측 콘텐츠(와인명 카드) 시작 x
    if (hasLogo) {
      // 로고 바운딩 박스: 병 컬럼(폭 1.9) 대비 사방 여백을 두어 답답함 완화. 비율은 아래 Math.min이 유지.
      const MAX_W = 1.7, MAX_H = 0.6, BAND_Y = 0.04, BAND_H = 0.78;
      const scale = Math.min(MAX_W / data.brandLogoW!, MAX_H / data.brandLogoH!);
      const w = data.brandLogoW! * scale, h = data.brandLogoH! * scale;
      try {
        doc.image(Buffer.from(data.brandLogoBase64!, "base64"), i(BOTTLE_CENTER - w / 2), i(BAND_Y + (BAND_H - h) / 2), { width: i(w), height: i(h) });
      } catch { /* ignore */ }
    }
    const textX = CONTENT_X;
    if (wName) {
      drawText(wName, textX, 0.24, 7.1 - textX, 18, fontEn, C.BURGUNDY, 2);
    }
  }

  // ── 본문 데이터 준비(disclaimer 제거 → 과도한 텍스트 정리) ──
  const winery = capSentences(cleanField(data.wineryDescription), 4, 300);
  const vintageNote = capSentences(cleanField(data.vintageNote), 1, 95);
  const countryEn = data.countryEn || data.country || "";
  const regionText = data.region ? `${countryEn}, ${data.region}` : countryEn || "-";
  let winemakingText = cleanField(data.winemaking) || "-";
  if (data.alcoholPercentage) winemakingText += `\nAlc. ${data.alcoholPercentage}`;
  // 테이스팅 노트는 COLOR/NOSE/PALATE 3개만
  const tItems: [string, string][] = ([
    ["COLOR", cleanField(data.colorNote)], ["NOSE", cleanField(data.noseNote)],
    ["PALATE", cleanField(data.palateNote)],
  ].filter(([, v]) => v) as [string, string][]);

  /**
   * 본문을 한 번 흐르게 그림(draw=true) 또는 높이만 측정(draw=false).
   * s = 스케일. 폰트/간격을 s 배율로 조정. @returns 최종 y(인치).
   */
  const body = (s: number, draw: boolean): number => {
    let y = BODY_TOP;
    const fs = (b: number) => b * s;
    const gap = (g: number) => g * (0.5 + 0.5 * s); // 간격은 절반만 스케일(너무 좁아지지 않게)

    const inlineRow = (label: string, value: string, labelW: number) => {
      if (draw) drawLabelBadge(doc, label, CX, y, labelW, 0.22, fontBold);
      const vx = TX + labelW + 0.12, vw = TW - labelW - 0.12;
      const h = measure(value, vw, fs(9.5), fontRegular);
      if (draw) drawText(value, vx, y + 0.02, vw, fs(9.5), fontRegular, C.TEXT_PRIMARY);
      y += Math.max(0.26, h) + gap(0.08);
      if (draw) drawLine(doc, TX, y - 0.05, TW, C.DIVIDER_LIGHT, 0.4);
      y += gap(0.07);
    };

    const blockRow = (label: string, labelW: number, text: string, baseFs: number) => {
      if (draw) drawLabelBadge(doc, label, CX, y, labelW, 0.22, fontBold);
      y += gap(0.30);
      const lg = 2.2 * s;
      const h = measure(text, TW, fs(baseFs), fontRegular, lg);
      if (draw) drawText(text, TX, y, TW, fs(baseFs), fontRegular, C.TEXT_PRIMARY, lg);
      y += h + gap(0.16);
    };

    inlineRow("지역", regionText, LABEL_W);
    inlineRow("품종", data.grapeVarieties || "-", LABEL_W);

    // 빈티지
    if (draw) {
      drawLabelBadge(doc, "빈티지", CX, y, LABEL_W, 0.22, fontBold);
      drawText(data.vintage || "-", TX + LABEL_W + 0.12, y - 0.02, 0.65, fs(13), fontBold, C.BURGUNDY);
    }
    if (vintageNote) {
      const vnW = TW - 1.55;
      const h = measure(vintageNote, vnW, fs(8), fontRegular);
      if (draw) drawText(vintageNote, 3.70, y + 0.01, vnW, fs(8), fontRegular, C.TEXT_SECONDARY);
      y += Math.max(0.26, h) + gap(0.08);
    } else {
      y += 0.26 + gap(0.08);
    }
    if (draw) drawLine(doc, TX, y - 0.05, TW, C.DIVIDER_LIGHT, 0.4);
    y += gap(0.07);

    if (winery) blockRow("와이너리", LABEL_W, winery, 8.7);
    blockRow("양조", LABEL_W, winemakingText, 9.6);

    // 테이스팅 노트 카드 (내용 높이만큼)
    if (tItems.length > 0) {
      y += 0.16; // 양조↔카드 최소 간격
      const innerW = TW - 0.48;
      const itemX = TX + 0.2; // 문단은 바에서 살짝 우측으로 들여쓰기
      const fsT = fs(9.8);
      let contentH = gap(0.40);
      for (const [, v] of tItems) contentH += 0.15 + measure(v, innerW, fsT, fontRegular, 2 * s) + gap(0.09);
      const cardH = contentH + gap(0.10);
      if (draw) {
        // 좌측 포인트 바: 라벨 배지와 동일 x(CX), 시작만 살짝 아래로, 본문 하한까지 확장
        const barH = Math.max(cardH, BODY_BOTTOM - y);
        drawRect(doc, CX, y + 0.1, 0.06, barH - 0.1, C.GOLD);
        // 타이틀: 아웃라인 배지(다른 라벨과 동일 — 채움 없음, 글자색 통일)
        drawLabelBadge(doc, "TASTING NOTE", CX + 0.15, y + 0.08, 1.32, 0.22, fontBold);

        // 문단(COLOR/NOSE/PALATE)을 확장 영역 안에 균등 간격으로 배치
        const heights = tItems.map(([, v]) => 0.16 + measure(v, innerW, fsT, fontRegular, 2 * s));
        const sumH = heights.reduce((a, b) => a + b, 0);
        let cy = y + gap(0.40);
        const spare = y + barH - 0.15 - cy - sumH;
        const gapEven = Math.max(gap(0.09), Math.min(spare / tItems.length, 0.55));
        tItems.forEach(([label, v], idx) => {
          doc.save().font(fontEn).fontSize(fs(9)).fillColor(C.BURGUNDY)
            .text(`— ${label}`, i(itemX), i(cy), { width: i(innerW), characterSpacing: 1 }).restore();
          drawText(v, itemX, cy + 0.16, innerW, fsT, fontRegular, C.TEXT_PRIMARY, 2 * s);
          cy += heights[idx] + gapEven;
        });
      }
      y += cardH + gap(0.14);
    }

    return y;
  };

  // ── fit-to-one-page: 측정 → 스케일 산출 → 렌더 ──
  const avail = BODY_BOTTOM - BODY_TOP;
  const used1 = body(1.0, false) - BODY_TOP;
  let s = Math.sqrt(avail / used1);               // 높이 ∝ 폰트² 근사
  s = Math.max(0.64, Math.min(1.22, s));
  const used2 = body(s, false) - BODY_TOP;         // 스케일 적용 후 실측 보정
  if (used2 > avail) s = Math.max(0.58, s * (avail / used2));
  body(s, true);

  // ── 푸터(하단 고정) ──
  drawLine(doc, 0.15, 9.04, 7.20, C.GOLD_LIGHT, 0.5);
  const awards = capChars(cleanAwards(data.awards), 130);
  if (awards) {
    try {
      const iconBuffer = Buffer.from(ICON_AWARD_BASE64, "base64");
      doc.image(iconBuffer, i(0.25), i(9.08), { width: i(0.22), height: i(0.28) });
    } catch { /* ignore */ }
    doc.save().font(fontBold).fontSize(8).fillColor(C.GOLD)
      .text("AWARDS  ", i(0.52), i(9.12), { continued: true })
      .font(fontRegular).fontSize(8.5).fillColor(C.TEXT_PRIMARY)
      .text(awards, { width: i(6.6) }).restore();
  }
  drawLine(doc, 0.20, 9.52, 7.10, C.BURGUNDY, 2.0);
  drawLine(doc, 0.20, 9.55, 7.10, C.GOLD_LIGHT, 0.75);
  // 푸터 로고 — 구분선(9.55)~페이지 바닥(10.0) 밴드에 세로 중앙, 원본 비율(1812×570) 유지
  const FOOTER_TOP = 9.55, FOOTER_H = 0.45;
  const LOGO_H = 0.28, LOGO_W = LOGO_H * (1812 / 570);
  try {
    const logoBuffer = Buffer.from(LOGO_CAVEDEVIN_BASE64, "base64");
    doc.image(logoBuffer, i(0.09), i(FOOTER_TOP + (FOOTER_H - LOGO_H) / 2), { width: i(LOGO_W), height: i(LOGO_H) });
  } catch { /* ignore */ }
  drawText("T. 02-786-3136  |  www.cavedevin.com", 0.09 + LOGO_W + 0.1, FOOTER_TOP + FOOTER_H / 2 - 0.05, 2.76, 7, fontRegular, C.TEXT_MUTED);

  // ── 좌측 패널: 병 이미지(+ 와이너리 사진) ──
  const hasWineryPhoto = !!(data.wineryImageBase64 && data.wineryImageMimeType);

  // 병 이미지(워터마크 위치별 크롭). 사진 있으면 위쪽 영역으로 축소.
  if (data.bottleImageBase64 && data.bottleImageMimeType) {
    try {
      const imgBuffer = Buffer.from(data.bottleImageBase64, "base64");
      const boxX = i(0.25), boxY = i(1.95);
      const boxW = i(1.60), boxH = i(hasWineryPhoto ? 4.35 : 5.50);
      const img = doc.openImage(imgBuffer);
      const rightFrac = data.bottleCropRight ? 0.12 : 0;
      const bottomFrac = data.bottleCropBottom ? 0.05 : 0; // Vivino 워터마크만 제거(병 베이스 보존)
      const srcVisW = img.width * (1 - rightFrac);
      const srcVisH = img.height * (1 - bottomFrac);
      const scale = Math.min(boxW / srcVisW, boxH / srcVisH);
      const visW = srcVisW * scale, visH = srcVisH * scale;
      const drawX = boxX + (boxW - visW) / 2;
      const drawY = boxY + (boxH - visH) / 2;
      doc.save().rect(drawX, drawY, visW, visH).clip();
      doc.image(imgBuffer, drawX, drawY, { width: img.width * scale, height: img.height * scale });
      doc.restore();
    } catch (e) {
      logger.warn(`[PDF] Failed to add bottle image: ${e}`);
    }
  }

  // 와이너리/포도밭 사진 — 좌측 패널 하단을 cover-fit로 채움.
  if (hasWineryPhoto) {
    try {
      const imgBuffer = Buffer.from(data.wineryImageBase64!, "base64");
      const bx = 0.18, by = 6.55, bw = 1.78, bh = 2.18; // 인치
      const img = doc.openImage(imgBuffer);
      const scale = Math.max(i(bw) / img.width, i(bh) / img.height); // cover
      const dW = img.width * scale, dH = img.height * scale;
      const dX = i(bx) + (i(bw) - dW) / 2, dY = i(by) + (i(bh) - dH) / 2;
      doc.save();
      drawRoundedRect(doc, bx, by, bw, bh, C.WHITE, C.CARD_BORDER);
      doc.roundedRect(i(bx), i(by), i(bw), i(bh), i(0.04)).clip();
      doc.image(imgBuffer, dX, dY, { width: dW, height: dH });
      doc.restore();
    } catch (e) {
      logger.warn(`[PDF] Failed to add winery image: ${e}`);
    }
  }
}
