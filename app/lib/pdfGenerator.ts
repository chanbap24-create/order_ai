// PDF 생성기 - pdfkit 기반 (Vercel 서버리스 호환)
// Python reportlab (child_process) → pdfkit (pure JS) 마이그레이션

import PDFDocument from "pdfkit";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { getWineByCode, getTastingNote } from "@/app/lib/wineDb";
import { downloadImageAsBase64, searchVivinoBottleImage } from "@/app/lib/wineImageSearch";
import { LOGO_CAVEDEVIN_BASE64, ICON_AWARD_BASE64 } from "@/app/lib/pptAssets";
import { logger } from "@/app/lib/logger";

// ═══════════════════════════════════════════════════
// 단위 변환: inches → points (72pt = 1inch)
// ═══════════════════════════════════════════════════
const PT = 72;
function i(inches: number): number {
  return inches * PT;
}

// ═══════════════════════════════════════════════════
// 와인 테마 컬러 팔레트
// ═══════════════════════════════════════════════════
const C = {
  BG_BOTTLE_AREA: "#F5F0EA",
  BURGUNDY: "#722F37",
  BURGUNDY_DARK: "#5A252C",
  BURGUNDY_LIGHT: "#F2E8EA",
  GOLD: "#B8976A",
  GOLD_LIGHT: "#D4C4A8",
  TEXT_PRIMARY: "#2C2C2C",
  TEXT_SECONDARY: "#5A5A5A",
  TEXT_MUTED: "#8A8A8A",
  TEXT_ON_DARK: "#FFFFFF",
  CARD_BORDER: "#E0D5C8",
  DIVIDER: "#D4C4A8",
  DIVIDER_LIGHT: "#E8DDD0",
  WHITE: "#FFFFFF",
};

// 페이지 크기 (인치) - 세로 A4 스타일
const PAGE_W = 7.5;
const PAGE_H = 10.0;

// ─── 폰트 관리 ───
const FONT_DIR = process.env.VERCEL ? "/tmp/fonts" : join(process.cwd(), "output", "fonts");
const FONT_REGULAR = "NotoSansKR-Regular.otf";
const FONT_BOLD = "NotoSansKR-Bold.otf";

// 폰트 다운로드 소스 (순서대로 시도)
const FONT_SOURCES = [
  {
    regular: "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/SubsetOTF/KR/NotoSansKR-Regular.otf",
    bold: "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/SubsetOTF/KR/NotoSansKR-Bold.otf",
  },
  {
    regular: "https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/SubsetOTF/KR/NotoSansKR-Regular.otf",
    bold: "https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/SubsetOTF/KR/NotoSansKR-Bold.otf",
  },
];

// Windows 시스템 폰트 경로
const SYSTEM_FONTS_WIN = [
  "C:\\Windows\\Fonts\\malgun.ttf",       // 맑은 고딕 Regular
  "C:\\Windows\\Fonts\\malgunbd.ttf",     // 맑은 고딕 Bold
];

interface FontPaths {
  regular: string;
  bold: string;
}

async function ensureKoreanFont(): Promise<FontPaths | null> {
  // 1) Windows 시스템 폰트 확인
  if (process.platform === "win32" && existsSync(SYSTEM_FONTS_WIN[0]) && existsSync(SYSTEM_FONTS_WIN[1])) {
    return { regular: SYSTEM_FONTS_WIN[0], bold: SYSTEM_FONTS_WIN[1] };
  }

  // 2) 캐시 확인
  const regularPath = join(FONT_DIR, FONT_REGULAR);
  const boldPath = join(FONT_DIR, FONT_BOLD);
  if (existsSync(regularPath) && existsSync(boldPath)) {
    return { regular: regularPath, bold: boldPath };
  }

  // 3) CDN에서 다운로드
  mkdirSync(FONT_DIR, { recursive: true });

  for (const source of FONT_SOURCES) {
    try {
      logger.info(`[PDF] Downloading Korean font from CDN...`);
      const [regularRes, boldRes] = await Promise.all([
        fetch(source.regular, { signal: AbortSignal.timeout(20000) }),
        fetch(source.bold, { signal: AbortSignal.timeout(20000) }),
      ]);

      if (!regularRes.ok || !boldRes.ok) continue;

      const regularBuf = Buffer.from(await regularRes.arrayBuffer());
      const boldBuf = Buffer.from(await boldRes.arrayBuffer());

      // 최소 크기 검증 (폰트 파일은 최소 100KB)
      if (regularBuf.length < 100000 || boldBuf.length < 100000) continue;

      writeFileSync(regularPath, regularBuf);
      writeFileSync(boldPath, boldBuf);

      logger.info(`[PDF] Korean font cached: ${regularBuf.length + boldBuf.length} bytes`);
      return { regular: regularPath, bold: boldPath };
    } catch (e) {
      logger.warn(`[PDF] Font download failed, trying next source...`, { error: e });
      continue;
    }
  }

  logger.warn("[PDF] Korean font not available, using Helvetica fallback");
  return null;
}

// ─── 헬퍼: 빈티지 2자리→4자리 변환 ───
function formatVintage4(v: string): string {
  if (!v || v === "-") return "-";
  if (/^(NV|MV)$/i.test(v)) return v.toUpperCase();
  if (/^\d{4}$/.test(v)) return v;
  const num = parseInt(v, 10);
  if (!isNaN(num)) {
    return num >= 50
      ? `19${String(num).padStart(2, "0")}`
      : `20${String(num).padStart(2, "0")}`;
  }
  return v;
}

// ─── 헬퍼: 투명도가 적용된 색상 (pdfkit은 opacity로 처리) ───
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function blendWithWhite(hex: string, opacity: number): string {
  const [r, g, b] = hexToRgb(hex);
  const blend = (c: number) => Math.round(c * opacity + 255 * (1 - opacity));
  return `#${blend(r).toString(16).padStart(2, "0")}${blend(g).toString(16).padStart(2, "0")}${blend(b).toString(16).padStart(2, "0")}`;
}

// ─── 슬라이드 데이터 인터페이스 ───
interface SlideData {
  nameKr: string;
  nameEn: string;
  country: string;
  countryEn: string;
  region: string;
  grapeVarieties: string;
  vintage: string;
  vintageNote: string;
  wineryDescription: string;
  winemaking: string;
  alcoholPercentage: string;
  agingPotential: string;
  colorNote: string;
  noseNote: string;
  palateNote: string;
  foodPairing: string;
  glassPairing: string;
  servingTemp: string;
  awards: string;
  bottleImageBase64?: string;
  bottleImageMimeType?: string;
}

// ─── PDF 렌더링 헬퍼 ───
function drawLine(doc: PDFKit.PDFDocument, x: number, y: number, w: number, color: string, widthPt: number = 0.75) {
  doc.save()
    .moveTo(i(x), i(y))
    .lineTo(i(x + w), i(y))
    .lineWidth(widthPt)
    .strokeColor(color)
    .stroke()
    .restore();
}

function drawRect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, fillColor: string) {
  doc.save().rect(i(x), i(y), i(w), i(h)).fill(fillColor).restore();
}

function drawRoundedRect(
  doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number,
  fillColor: string, borderColor?: string, borderWidth: number = 0.5, radius: number = 3
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

function drawLabelBadge(
  doc: PDFKit.PDFDocument, text: string, x: number, y: number, w: number, h: number = 0.22,
  fontBold: string
) {
  drawRoundedRect(doc, x, y, w, h, C.BURGUNDY);
  doc.save()
    .font(fontBold)
    .fontSize(8.5)
    .fillColor(C.TEXT_ON_DARK);
  const textY = i(y) + (i(h) - 8.5) / 2;
  doc.text(text, i(x), textY, { width: i(w), align: "center" })
    .restore();
}

// ─── 단일 페이지 렌더링 ───
function renderPage(doc: PDFKit.PDFDocument, data: SlideData, fontRegular: string, fontBold: string, fontEn: string) {
  // 배경: 흰색
  drawRect(doc, 0, 0, PAGE_W, PAGE_H, C.WHITE);

  // 1. 좌측 병 영역 배경 (40% 투명도 → 흰색과 블렌딩)
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
    // Label (Georgia Italic style)
    doc.save().font(fontEn).fontSize(8.5).fillColor(C.BURGUNDY)
      .text(label, i(2.15), noteY, { width: i(5.00) }).restore();
    noteY += 11;
    // Value
    doc.save().font(fontRegular).fontSize(9).fillColor(C.TEXT_PRIMARY)
      .text(value, i(2.15), noteY, { width: i(5.00), lineGap: 2 }).restore();
    noteY += doc.heightOfString(value, { width: i(5.00), fontSize: 9 }) + 8;
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
    .text("T. 02-786-3136  |  www.cavedevin.co.kr", i(1.12), i(9.72), {
      width: i(2.76), align: "right",
    }).restore();

  // 18. 병 이미지
  if (data.bottleImageBase64 && data.bottleImageMimeType) {
    try {
      const imgBuffer = Buffer.from(data.bottleImageBase64, "base64");
      doc.image(imgBuffer, i(0.25), i(2.00), {
        fit: [i(1.60), i(5.50)],
        align: "center",
        valign: "center",
      });
    } catch (e) {
      logger.warn(`[PDF] Failed to add bottle image: ${e}`);
    }
  }
}

// ════════════════════════════════════════════════════
// 공개 API
// ════════════════════════════════════════════════════

/** 단일 와인 PDF 생성 */
export async function generateSingleWinePdf(wineId: string): Promise<Buffer> {
  return generateTastingNotePdf([wineId]);
}

/** 여러 와인의 테이스팅 노트 PDF 생성 */
export async function generateTastingNotePdf(wineIds: string[]): Promise<Buffer> {
  const slides: SlideData[] = [];

  for (const wineId of wineIds) {
    const wine = await getWineByCode(wineId);
    if (!wine) continue;

    const note = await getTastingNote(wineId);

    let bottleImageBase64: string | undefined;
    let bottleImageMimeType: string | undefined;

    const engName = wine.item_name_en;
    if (engName) {
      try {
        const vivinoUrl = await searchVivinoBottleImage(engName);
        if (vivinoUrl) {
          const imgData = await downloadImageAsBase64(vivinoUrl);
          if (imgData) {
            bottleImageBase64 = imgData.base64;
            bottleImageMimeType = imgData.mimeType;
          }
        }
      } catch { /* ignore */ }
    }

    if (!bottleImageBase64 && wine.image_url) {
      try {
        const imgData = await downloadImageAsBase64(wine.image_url);
        if (imgData) {
          bottleImageBase64 = imgData.base64;
          bottleImageMimeType = imgData.mimeType;
        }
      } catch { /* ignore */ }
    }

    slides.push({
      nameKr: wine.item_name_kr,
      nameEn: wine.item_name_en || "",
      country: wine.country || "",
      countryEn: wine.country_en || "",
      region: wine.region || "",
      grapeVarieties: wine.grape_varieties || "",
      vintage: formatVintage4(wine.vintage || ""),
      vintageNote: note?.vintage_note || "",
      wineryDescription: note?.winery_description || "",
      winemaking: note?.winemaking || "",
      alcoholPercentage: wine.alcohol || "",
      agingPotential: note?.aging_potential || "",
      colorNote: note?.color_note || "",
      noseNote: note?.nose_note || "",
      palateNote: note?.palate_note || "",
      foodPairing: note?.food_pairing || "",
      glassPairing: note?.glass_pairing || "",
      servingTemp: note?.serving_temp || "",
      awards: note?.awards || "",
      bottleImageBase64,
      bottleImageMimeType,
    });
  }

  if (slides.length === 0) {
    throw new Error("생성할 페이지가 없습니다.");
  }

  // 한국어 폰트 준비
  const fonts = await ensureKoreanFont();

  // PDF 생성
  const doc = new PDFDocument({
    size: [i(PAGE_W), i(PAGE_H)],
    margin: 0,
    autoFirstPage: false,
  });

  // 폰트 등록
  let fontRegular = "Helvetica";
  let fontBold = "Helvetica-Bold";
  const fontEn = "Times-Italic";

  if (fonts) {
    try {
      doc.registerFont("Korean", fonts.regular);
      doc.registerFont("KoreanBold", fonts.bold);
      fontRegular = "Korean";
      fontBold = "KoreanBold";
    } catch (e) {
      logger.warn(`[PDF] Font registration failed, using Helvetica: ${e}`);
    }
  }

  // Buffer 수집
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  // 페이지 렌더링
  for (const data of slides) {
    doc.addPage();
    renderPage(doc, data, fontRegular, fontBold, fontEn);
  }

  doc.end();

  return new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      logger.info(`[PDF] Generated: ${slides.length} pages (pdfkit, ${pdfBuffer.length} bytes)`);
      resolve(pdfBuffer);
    });
    doc.on("error", reject);
  });
}
