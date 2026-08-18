// 브랜드북 PDF 렌더 — pdfkit. 브랜드 소개 페이지 + 출고 가능 와인 목록(병샷 포함).
// 테이스팅노트 PDF 엔진(theme/fonts)을 재사용, 페이지 문법은 원본 브랜드북을 참고한 화이트+버건디.
import PDFDocument from 'pdfkit';
import { i, PAGE_W, PAGE_H, C } from '@/app/lib/pdf-generator/theme';
import { ensureKoreanFont } from '@/app/lib/pdf-generator/fonts';
import { downloadImageAsBase64 } from '@/app/lib/wineImageSearch';
import { logger } from '@/app/lib/logger';
import sharp from 'sharp';
import type { BookBrand, BookWine } from './data';

const won = (n: number) => n.toLocaleString('ko-KR');

type Img = { buf: Buffer; mime: string } | null;

/** 이미지 축소·재압축 — 원본 그대로 임베드하면 책이 수십 MB가 되므로 필수.
 *  병샷: 흰 배경 플래튼 + 높이 560px JPEG. 로고: 투명 유지 PNG 360px. */
async function fetchImg(url: string | null, kind: 'bottle' | 'logo' = 'bottle'): Promise<Img> {
  if (!url) return null;
  try {
    const d = await downloadImageAsBase64(url);
    if (!d) return null;
    const raw = Buffer.from(d.base64, 'base64');
    if (kind === 'logo') {
      const buf = await sharp(raw).resize({ width: 360, withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
      return { buf, mime: 'image/png' };
    }
    const buf = await sharp(raw).flatten({ background: '#ffffff' })
      .resize({ height: 560, withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
    return { buf, mime: 'image/jpeg' };
  } catch { return null; }
}

/** 병렬 이미지 프리페치(동시 6) */
async function prefetchImages(brand: BookBrand): Promise<Map<string, Img>> {
  const out = new Map<string, Img>();
  const jobs: Array<{ key: string; url: string | null }> = [
    { key: '__logo__', url: brand.logo_url },
    ...brand.wines.map((w) => ({ key: w.item_code, url: w.image_url })),
  ];
  let idx = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (idx < jobs.length) {
      const j = jobs[idx++];
      out.set(j.key, await fetchImg(j.url, j.key === '__logo__' ? 'logo' : 'bottle'));
    }
  }));
  return out;
}

/** 페이지 하단 푸터 */
function footer(doc: PDFKit.PDFDocument, fontRegular: string, pageNo: number) {
  doc.save().font(fontRegular).fontSize(7.5).fillColor(C.GRAY_MID || '#8a8a8a');
  doc.text('CAVE DE VIN · T. 02-786-3136 · www.cavedevin.com · 가격은 공급가(VAT 별도) 기준', i(0.5), i(PAGE_H - 0.55), { width: i(PAGE_W - 1.6), align: 'left' });
  doc.text(String(pageNo), i(PAGE_W - 1.0), i(PAGE_H - 0.55), { width: i(0.5), align: 'right' });
  doc.restore();
}

/** 브랜드 헤더(소개) — 로고 · 브랜드명 · 국가/지역 · 소개문. 반환: 본문 시작 y(inch) */
function brandHeader(
  doc: PDFKit.PDFDocument, b: BookBrand, logo: Img,
  fontRegular: string, fontBold: string,
): number {
  let y = 0.85;
  if (logo) {
    try {
      doc.image(logo.buf, i(PAGE_W / 2 - 0.9), i(y), { fit: [i(1.8), i(0.75)], align: 'center', valign: 'center' });
      y += 0.95;
    } catch { /* 로고 실패 시 생략 */ }
  }
  doc.font(fontBold).fontSize(21).fillColor('#5a252c')
    .text(b.name_kr, i(0.7), i(y), { width: i(PAGE_W - 1.4), align: 'center' });
  y += 0.42;
  if (b.name_en) {
    doc.font(fontRegular).fontSize(11).fillColor('#8a6a48')
      .text(b.name_en, i(0.7), i(y), { width: i(PAGE_W - 1.4), align: 'center', characterSpacing: 1.5 });
    y += 0.28;
  }
  const geo = [b.country, b.region].filter(Boolean).join(' · ');
  if (geo) {
    doc.font(fontRegular).fontSize(9.5).fillColor('#6b7280')
      .text(geo, i(0.7), i(y), { width: i(PAGE_W - 1.4), align: 'center' });
    y += 0.34;
  }
  // 구분 헤어라인(버건디+골드 이중선 — 원본 브랜드북 문법)
  doc.save().moveTo(i(1.2), i(y)).lineTo(i(PAGE_W - 1.2), i(y)).lineWidth(1).strokeColor('#722f37').stroke().restore();
  doc.save().moveTo(i(1.2), i(y + 0.03)).lineTo(i(PAGE_W - 1.2), i(y + 0.03)).lineWidth(0.5).strokeColor('#d4c4a8').stroke().restore();
  y += 0.22;
  if (b.description) {
    const desc = b.description.length > 700 ? b.description.slice(0, 700) + '…' : b.description;
    doc.font(fontRegular).fontSize(9.5).fillColor('#4a3f34')
      .text(desc, i(1.0), i(y), { width: i(PAGE_W - 2.0), align: 'justify', lineGap: 3 });
    y += doc.heightOfString(desc, { width: i(PAGE_W - 2.0), lineGap: 3 }) / 72 + 0.3;
  }
  return y;
}

const ROW_H = 1.5;          // 와인 행 기본 높이(inch)
const ROW_BOTTOM = PAGE_H - 0.8;
const TX = 1.85, TW = 4.05; // 텍스트 x·폭

/** 영문명이 한 줄을 넘는지 — 넘으면 2줄 허용하고 행 높이를 늘린다(겹침 방지) */
function enLineCount(doc: PDFKit.PDFDocument, w: BookWine, fontRegular: string): number {
  const enLine = [w.name_en, w.vintage].filter(Boolean).join(' ');
  if (!enLine) return 0;
  doc.font(fontRegular).fontSize(8.5);
  return doc.widthOfString(enLine) > i(TW) ? 2 : 1;
}

/** 이 와인 행이 차지할 높이 — 영문명 2줄이면 +0.19in */
function rowHeight(doc: PDFKit.PDFDocument, w: BookWine, fontRegular: string): number {
  return ROW_H + (enLineCount(doc, w, fontRegular) === 2 ? 0.19 : 0);
}

/** 와인 한 행 — 좌 병샷, 우 텍스트, 우측 끝 가격 */
function wineRow(
  doc: PDFKit.PDFDocument, w: BookWine, img: Img, y: number,
  fontRegular: string, fontBold: string,
) {
  const rh = rowHeight(doc, w, fontRegular);
  // 병샷 (0.95in 폭 박스)
  if (img) {
    try {
      doc.image(img.buf, i(0.65), i(y + 0.08), { fit: [i(0.95), i(rh - 0.2)], align: 'center', valign: 'center' });
    } catch { /* 이미지 실패 시 공란 */ }
  }
  const tx = TX, tw = TW;
  let ty = y + 0.16;
  doc.font(fontBold).fontSize(11.5).fillColor('#241a14')
    .text(w.name_kr, i(tx), i(ty), { width: i(tw), height: i(0.22), lineBreak: false, ellipsis: true });
  ty += 0.24;
  const enLine = [w.name_en, w.vintage].filter(Boolean).join(' ');
  if (enLine) {
    const two = enLineCount(doc, w, fontRegular) === 2;
    doc.font(fontRegular).fontSize(8.5).fillColor('#9ca3af')
      .text(enLine, i(tx), i(ty), { width: i(tw), height: i(two ? 0.4 : 0.2), ellipsis: true, lineGap: 1 });
    ty += two ? 0.4 : 0.21;
  }
  if (w.region) {
    doc.font(fontRegular).fontSize(8.5).fillColor('#6b7280')
      .text(w.region, i(tx), i(ty), { width: i(tw), height: i(0.18), lineBreak: false, ellipsis: true });
    ty += 0.2;
  }
  if (w.grapes) {
    doc.font(fontRegular).fontSize(8.5).fillColor('#6b7280')
      .text(w.grapes, i(tx), i(ty), { width: i(tw), height: i(0.18), lineBreak: false, ellipsis: true });
    ty += 0.2;
  }
  if (w.flavors.length) {
    doc.font(fontRegular).fontSize(8).fillColor('#8a6a48')
      .text(w.flavors.join(' · '), i(tx), i(ty), { width: i(tw), height: i(0.18), lineBreak: false, ellipsis: true });
  }
  // 가격 (우측 정렬, 세로 중앙쯤)
  doc.font(fontBold).fontSize(12).fillColor('#722f37')
    .text(`${won(w.supply_price)}원`, i(PAGE_W - 1.85), i(y + 0.5), { width: i(1.35), align: 'right' });
  // 행 구분 헤어라인
  doc.save().moveTo(i(0.65), i(y + rh - 0.05)).lineTo(i(PAGE_W - 0.5), i(y + rh - 0.05))
    .lineWidth(0.5).strokeColor('#ebebeb').stroke().restore();
  return rh;
}

/** 브랜드 1개(파일럿) 또는 여러 브랜드를 이어서 렌더 */
export async function renderBrandBookPdf(brands: BookBrand[]): Promise<Buffer> {
  const fonts = await ensureKoreanFont();
  const doc = new PDFDocument({ size: [i(PAGE_W), i(PAGE_H)], margin: 0, autoFirstPage: false });
  let fontRegular = 'Helvetica', fontBold = 'Helvetica-Bold';
  if (fonts) {
    try {
      doc.registerFont('Korean', fonts.regular);
      doc.registerFont('KoreanBold', fonts.bold);
      fontRegular = 'Korean'; fontBold = 'KoreanBold';
    } catch (e) { logger.warn(`[BrandBook] font fallback: ${e}`); }
  }
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  let pageNo = 0;
  // ── 표지 ──
  const year = new Date(Date.now() + 9 * 3600_000).getFullYear();
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  doc.addPage(); pageNo++;
  doc.rect(0, 0, i(PAGE_W), i(PAGE_H)).fill('#ffffff');
  doc.font(fontRegular).fontSize(13).fillColor('#8a6a48')
    .text('C A V E   D E   V I N', 0, i(3.6), { width: i(PAGE_W), align: 'center', characterSpacing: 2 });
  doc.font(fontBold).fontSize(30).fillColor('#241a14')
    .text(`WINE COLLECTION ${year}`, 0, i(4.1), { width: i(PAGE_W), align: 'center' });
  doc.font(fontRegular).fontSize(10.5).fillColor('#6b7280')
    .text(`${today} 재고 기준 · 공급가(VAT 별도)`, 0, i(4.85), { width: i(PAGE_W), align: 'center' });
  doc.save().moveTo(i(2.4), i(5.35)).lineTo(i(PAGE_W - 2.4), i(5.35)).lineWidth(1).strokeColor('#722f37').stroke().restore();

  const EN_COUNTRY: Record<string, string> = {
    '프랑스': 'FRANCE', '이탈리아': 'ITALY', '스페인': 'SPAIN', '포르투갈': 'PORTUGAL', '독일': 'GERMANY',
    '미국': 'USA', '칠레': 'CHILE', '아르헨티나': 'ARGENTINA', '호주': 'AUSTRALIA', '뉴질랜드': 'NEW ZEALAND', '영국': 'ENGLAND',
  };
  // 표기 혼용(영문/한글) 정규화 — 같은 국가가 두 번 나오지 않게
  const NORM: Record<string, string> = {
    France: '프랑스', Italy: '이탈리아', Spain: '스페인', Portugal: '포르투갈', Germany: '독일',
    USA: '미국', 'United States': '미국', Chile: '칠레', Argentina: '아르헨티나',
    Australia: '호주', 'New Zealand': '뉴질랜드', England: '영국',
  };
  const seenCountries = new Set<string>();
  for (const brand of brands) {
    // ── 국가 구분 페이지 — 국가별 최초 1회만 ──
    const country = NORM[brand.country] || brand.country;
    if (country && !seenCountries.has(country)) {
      seenCountries.add(country);
      doc.addPage(); pageNo++;
      doc.rect(0, 0, i(PAGE_W), i(PAGE_H)).fill('#3a2a22');
      doc.font(fontBold).fontSize(34).fillColor('#f2e9dd')
        .text(EN_COUNTRY[country] || country, 0, i(4.3), { width: i(PAGE_W), align: 'center', characterSpacing: 4 });
      doc.font(fontRegular).fontSize(12).fillColor('#c9b79c')
        .text(country, 0, i(5.0), { width: i(PAGE_W), align: 'center' });
    }
    const imgs = await prefetchImages(brand);
    doc.addPage(); pageNo++;
    doc.rect(0, 0, i(PAGE_W), i(PAGE_H)).fill('#ffffff');
    let y = brandHeader(doc, brand, imgs.get('__logo__') ?? null, fontRegular, fontBold);
    y += 0.1;
    for (const w of brand.wines) {
      const rh = rowHeight(doc, w, fontRegular);
      if (y + rh > ROW_BOTTOM) {
        footer(doc, fontRegular, pageNo);
        doc.addPage(); pageNo++;
        doc.rect(0, 0, i(PAGE_W), i(PAGE_H)).fill('#ffffff');
        // 이어지는 페이지 상단에 브랜드명 소제목
        doc.font(fontBold).fontSize(10).fillColor('#8a6a48')
          .text(`${brand.name_kr} (계속)`, i(0.65), i(0.55));
        y = 0.95;
      }
      wineRow(doc, w, imgs.get(w.item_code) ?? null, y, fontRegular, fontBold);
      y += rh;
    }
    footer(doc, fontRegular, pageNo);
  }

  doc.end();
  return new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}
