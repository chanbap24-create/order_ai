// 로고+아이콘+와인병 이미지 모두 포함한 완전한 테스트
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const PptxGenJS = (await import('pptxgenjs')).default;
const Database = require('better-sqlite3');
const fs = await import('fs');

const db = new Database('./data.sqlite3');
const wine = db.prepare('SELECT * FROM wines WHERE item_code = ?').get('2022079');
const note = db.prepare('SELECT * FROM tasting_notes WHERE wine_id = ?').get('2022079');
console.log('Wine:', wine.item_code, wine.item_name_kr);

// 로고/아이콘 base64 로드
const assetsFile = fs.readFileSync('./app/lib/pptAssets.ts', 'utf8');
const LOGO_B64 = assetsFile.match(/LOGO_CAVEDEVIN_BASE64\s*=\s*"([^"]+)"/)[1];
const ICON_B64 = assetsFile.match(/ICON_AWARD_BASE64\s*=\s*"([^"]+)"/)[1];
const LOGO_DATA = `image/jpeg;base64,${LOGO_B64}`;
const ICON_DATA = `image/jpeg;base64,${ICON_B64}`;

// 이미지 다운로드
async function downloadImage(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await res.arrayBuffer());
    return { base64: buffer.toString('base64'), mimeType: contentType.split(';')[0] };
  } catch { return null; }
}

// 빈티지 4자리 변환
function formatVintage4(v) {
  if (!v || v === '-') return '-';
  if (/^(NV|MV)$/i.test(v)) return v.toUpperCase();
  if (/^\d{4}$/.test(v)) return v;
  const num = parseInt(v, 10);
  if (!isNaN(num)) return num >= 50 ? `19${String(num).padStart(2, '0')}` : `20${String(num).padStart(2, '0')}`;
  return v;
}

// DB 이미지 다운로드 (조사 시 저장된 것 우선)
let bottleBase64 = null, bottleMime = null;
if (wine.image_url) {
  console.log('Downloading DB image:', wine.image_url);
  const img = await downloadImage(wine.image_url);
  if (img) { bottleBase64 = img.base64; bottleMime = img.mimeType; console.log('DB image OK:', bottleMime, bottleBase64.length); }
}

const COLORS = {
  BG_CREAM: 'FAF7F2', BG_BOTTLE_AREA: 'F5F0EA',
  BURGUNDY: '722F37', BURGUNDY_DARK: '5A252C', BURGUNDY_LIGHT: 'F2E8EA',
  GOLD: 'B8976A', GOLD_LIGHT: 'D4C4A8',
  TEXT_PRIMARY: '2C2C2C', TEXT_SECONDARY: '5A5A5A', TEXT_MUTED: '8A8A8A', TEXT_ON_DARK: 'FFFFFF',
  CARD_BORDER: 'E0D5C8', DIVIDER: 'D4C4A8', DIVIDER_LIGHT: 'E8DDD0',
};
const FM = '맑은 고딕', FE = 'Noto Sans KR', CR = 0.08, LR = 0.04;

const pptx = new PptxGenJS();
pptx.defineLayout({ name: 'PORTRAIT', width: 7.5, height: 10.0 });
pptx.layout = 'PORTRAIT';
pptx.author = '까브드뱅';
const slide = pptx.addSlide();
slide.background = { color: COLORS.BG_CREAM };

// 좌측 병 영역
slide.addShape('rect', { x: 0, y: 0.90, w: 2.10, h: 8.10, fill: { color: COLORS.BG_BOTTLE_AREA, transparency: 40 }, line: { width: 0 } });
slide.addShape('roundRect', { x: 7.15, y: 0.20, w: 0.06, h: 0.57, fill: { color: COLORS.BURGUNDY }, line: { width: 0 }, rectRadius: 0.03 });

// ★ 로고 (헤더) ★
try { slide.addImage({ data: LOGO_DATA, x: 0.20, y: 0.20, w: 1.49, h: 0.57 }); console.log('Header logo added'); } catch(e) { console.log('Header logo FAILED:', e.message); }

// 와이너리 태그라인
if (note?.winery_description) {
  const tagline = note.winery_description.split(/[.。]/)[0].trim();
  if (tagline) slide.addText(tagline, { x: 1.76, y: 0.20, w: 5.20, h: 0.24, fontSize: 9, fontFace: FE, color: COLORS.TEXT_MUTED, italic: true });
}

// 헤더 구분선
slide.addShape('line', { x: 0.20, y: 0.84, w: 7.10, h: 0, line: { color: COLORS.BURGUNDY, width: 0.75 } });
slide.addShape('line', { x: 0.20, y: 0.87, w: 7.10, h: 0, line: { color: COLORS.GOLD_LIGHT, width: 0.75 } });

// 와인명 카드
slide.addShape('roundRect', { x: 2.05, y: 0.97, w: 5.20, h: 0.76, rectRadius: CR, fill: { color: COLORS.BURGUNDY_LIGHT, transparency: 20 }, line: { color: COLORS.CARD_BORDER, width: 0.5 }, shadow: { type: 'outer', blur: 4, offset: 1.5, angle: 135, color: '000000', opacity: 0.08 } });
slide.addShape('roundRect', { x: 2.05, y: 1.01, w: 0.05, h: 0.68, fill: { color: COLORS.BURGUNDY }, line: { width: 0 }, rectRadius: 0.025 });

const nameKr = (wine.item_name_kr || '').replace(/^[A-Za-z]{2}\s+/, '');
slide.addText(nameKr, { x: 2.20, y: 1.00, w: 4.90, h: 0.36, fontSize: 14.5, fontFace: FM, color: COLORS.BURGUNDY_DARK, bold: true, valign: 'bottom' });
if (wine.item_name_en) slide.addText(wine.item_name_en, { x: 2.20, y: 1.36, w: 4.90, h: 0.30, fontSize: 10.5, fontFace: FM, color: COLORS.TEXT_SECONDARY, bold: true, italic: true, valign: 'top' });

// ★ 와인 병 이미지 ★
if (bottleBase64) {
  const mime = bottleMime || 'image/png';
  try {
    slide.addImage({ data: `${mime};base64,${bottleBase64}`, x: 0.30, y: 2.20, w: 1.50, h: 5.80, sizing: { type: 'contain', w: 1.50, h: 5.80 } });
    console.log('Bottle image added');
  } catch(e) { console.log('Bottle image FAILED:', e.message); }
}

slide.addShape('diamond', { x: 4.62, y: 1.79, w: 0.07, h: 0.07, fill: { color: COLORS.GOLD }, line: { width: 0 } });
slide.addShape('line', { x: 2.20, y: 1.82, w: 4.90, h: 0, line: { color: COLORS.DIVIDER, width: 0.75 } });

// 지역/품종
slide.addShape('roundRect', { x: 2.05, y: 1.92, w: 5.20, h: 0.95, rectRadius: CR, fill: { color: 'FFFFFF', transparency: 15 }, line: { color: COLORS.CARD_BORDER, width: 0.5 } });
slide.addShape('roundRect', { x: 2.12, y: 1.97, w: 0.55, h: 0.22, fill: { color: COLORS.BURGUNDY }, rectRadius: LR, line: { width: 0 } });
slide.addText('  지역  ', { x: 2.12, y: 1.97, w: 0.55, h: 0.22, color: COLORS.TEXT_ON_DARK, fontSize: 8.5, fontFace: FM, bold: true, align: 'center', valign: 'middle' });
const regionText = wine.region ? `${wine.country_en || ''}, ${wine.region}` : (wine.country_en || '-');
slide.addText(regionText, { x: 2.75, y: 1.96, w: 4.40, h: 0.24, fontSize: 9.5, fontFace: FM, color: COLORS.TEXT_PRIMARY, wrap: true });
slide.addShape('line', { x: 2.20, y: 2.35, w: 4.90, h: 0, line: { color: COLORS.DIVIDER_LIGHT, width: 0.75 } });
slide.addShape('roundRect', { x: 2.12, y: 2.42, w: 0.55, h: 0.22, fill: { color: COLORS.BURGUNDY }, rectRadius: LR, line: { width: 0 } });
slide.addText('  품종  ', { x: 2.12, y: 2.42, w: 0.55, h: 0.22, color: COLORS.TEXT_ON_DARK, fontSize: 8.5, fontFace: FM, bold: true, align: 'center', valign: 'middle' });
slide.addText(wine.grape_varieties || '-', { x: 2.75, y: 2.41, w: 4.40, h: 0.40, fontSize: 9.5, fontFace: FM, color: COLORS.TEXT_PRIMARY, wrap: true, valign: 'top' });

// 빈티지
slide.addShape('roundRect', { x: 2.05, y: 2.96, w: 5.20, h: 0.50, rectRadius: CR, fill: { color: 'FFFFFF', transparency: 15 }, line: { color: COLORS.CARD_BORDER, width: 0.5 } });
slide.addShape('roundRect', { x: 2.12, y: 3.02, w: 0.65, h: 0.22, fill: { color: COLORS.BURGUNDY }, rectRadius: LR, line: { width: 0 } });
slide.addText(' 빈티지 ', { x: 2.12, y: 3.02, w: 0.65, h: 0.22, color: COLORS.TEXT_ON_DARK, fontSize: 8.5, fontFace: FM, bold: true, align: 'center', valign: 'middle' });
slide.addText(formatVintage4(wine.vintage) || '-', { x: 2.85, y: 2.98, w: 0.75, h: 0.28, fontSize: 13, fontFace: FM, color: COLORS.BURGUNDY, bold: true });
if (note?.vintage_note) slide.addText(note.vintage_note, { x: 3.65, y: 3.00, w: 3.50, h: 0.40, fontSize: 8, fontFace: FM, color: COLORS.TEXT_SECONDARY, wrap: true, valign: 'top' });

// 양조
slide.addShape('roundRect', { x: 2.05, y: 3.56, w: 5.20, h: 1.65, rectRadius: CR, fill: { color: 'FFFFFF', transparency: 15 }, line: { color: COLORS.CARD_BORDER, width: 0.5 } });
slide.addShape('roundRect', { x: 2.12, y: 3.62, w: 0.55, h: 0.22, fill: { color: COLORS.BURGUNDY }, rectRadius: LR, line: { width: 0 } });
slide.addText('  양조  ', { x: 2.12, y: 3.62, w: 0.55, h: 0.22, color: COLORS.TEXT_ON_DARK, fontSize: 8.5, fontFace: FM, bold: true, align: 'center', valign: 'middle' });
slide.addText((note?.winemaking || '-') + (wine.alcohol ? `\n알코올: ${wine.alcohol}` : ''), { x: 2.15, y: 3.90, w: 5.00, h: 1.23, fontSize: 9, fontFace: FM, color: COLORS.TEXT_PRIMARY, valign: 'top', wrap: true, lineSpacingMultiple: 1.2 });

// 테이스팅 노트
slide.addShape('roundRect', { x: 2.05, y: 5.30, w: 5.20, h: 2.72, rectRadius: CR, fill: { color: COLORS.BURGUNDY_LIGHT, transparency: 30 }, line: { color: COLORS.CARD_BORDER, width: 0.5 } });
slide.addShape('roundRect', { x: 2.12, y: 5.35, w: 1.32, h: 0.22, fill: { color: COLORS.BURGUNDY }, rectRadius: LR, line: { width: 0 } });
slide.addText('  TASTING NOTE  ', { x: 2.12, y: 5.35, w: 1.32, h: 0.22, color: COLORS.TEXT_ON_DARK, fontSize: 7.5, fontFace: FE, bold: true, align: 'center', valign: 'middle' });

const tp = [];
let idx = 0;
for (const { label, value } of [
  { label: 'Color', value: note?.color_note },
  { label: 'Nose', value: note?.nose_note },
  { label: 'Palate', value: note?.palate_note },
  { label: 'Potential', value: note?.aging_potential },
  { label: 'Serving', value: note?.serving_temp },
]) {
  if (!value) continue;
  tp.push({ text: label, options: { fontSize: 8.5, fontFace: FE, color: COLORS.BURGUNDY, bold: true, breakType: idx > 0 ? 'break' : 'none', paraSpaceBefore: idx > 0 ? 6 : 0 } });
  tp.push({ text: '\n' + value, options: { fontSize: 9, fontFace: FM, color: COLORS.TEXT_PRIMARY, breakType: 'none' } });
  idx++;
}
if (!tp.length) tp.push({ text: '-', options: { fontSize: 9, fontFace: FM, color: COLORS.TEXT_MUTED } });
slide.addText(tp, { x: 2.15, y: 5.62, w: 5.00, h: 2.32, valign: 'top', lineSpacingMultiple: 1.15 });

// 푸드 페어링
slide.addShape('roundRect', { x: 2.05, y: 8.12, w: 5.20, h: 0.80, rectRadius: CR, fill: { color: 'FFFFFF', transparency: 15 }, line: { color: COLORS.CARD_BORDER, width: 0.5 } });
slide.addShape('roundRect', { x: 2.12, y: 8.18, w: 0.95, h: 0.22, fill: { color: COLORS.BURGUNDY }, rectRadius: LR, line: { width: 0 } });
slide.addText('푸드 페어링', { x: 2.12, y: 8.18, w: 0.95, h: 0.22, color: COLORS.TEXT_ON_DARK, fontSize: 8.5, fontFace: FM, bold: true, align: 'center', valign: 'middle' });
slide.addText(note?.food_pairing || '-', { x: 2.15, y: 8.42, w: 5.00, h: 0.44, fontSize: 9, fontFace: FM, color: COLORS.TEXT_PRIMARY, wrap: true, valign: 'top', lineSpacingMultiple: 1.2 });

// ★ 수상 (아이콘 포함) ★
slide.addShape('roundRect', { x: 0.15, y: 9.04, w: 7.20, h: 0.38, rectRadius: 0.04, fill: { color: COLORS.GOLD, transparency: 85 }, line: { color: COLORS.GOLD_LIGHT, width: 0.5 } });
try { slide.addImage({ data: ICON_DATA, x: 0.25, y: 9.08, w: 0.22, h: 0.28 }); console.log('Award icon added'); } catch(e) { console.log('Award icon FAILED:', e.message); }
slide.addText([
  { text: 'AWARDS  ', options: { fontSize: 8, fontFace: FE, color: COLORS.GOLD, bold: true } },
  { text: (note?.awards && note.awards !== 'N/A') ? note.awards : '', options: { fontSize: 9, fontFace: FM, color: COLORS.TEXT_PRIMARY } },
], { x: 0.52, y: 9.07, w: 6.70, h: 0.30, valign: 'middle' });

// ★ Footer (로고 포함) ★
slide.addShape('line', { x: 0.20, y: 9.52, w: 7.10, h: 0, line: { color: COLORS.BURGUNDY, width: 2.0 } });
slide.addShape('line', { x: 0.20, y: 9.55, w: 7.10, h: 0, line: { color: COLORS.GOLD_LIGHT, width: 0.75 } });
try { slide.addImage({ data: LOGO_DATA, x: 0.09, y: 9.68, w: 0.95, h: 0.25 }); console.log('Footer logo added'); } catch(e) { console.log('Footer logo FAILED:', e.message); }
slide.addText('T. 02-786-3136  |  www.cavedevin.co.kr', { x: 1.12, y: 9.69, w: 2.76, h: 0.24, fontSize: 7, fontFace: FE, color: COLORS.TEXT_MUTED, align: 'right' });
slide.addShape('diamond', { x: 7.17, y: 9.77, w: 0.06, h: 0.06, fill: { color: COLORS.GOLD }, line: { width: 0 } });

const output = await pptx.write({ outputType: 'nodebuffer' });
const buf = Buffer.from(output);
fs.writeFileSync('output/test-full-2022079.pptx', buf);
console.log(`\nSaved: output/test-full-2022079.pptx (${buf.length} bytes)`);
db.close();
