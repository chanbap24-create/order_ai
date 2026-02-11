// 실제 pptGenerator 로직으로 PPT 생성 테스트
import Database from 'better-sqlite3';
import PptxGenJS from 'pptxgenjs';
import fs from 'fs';

const db = new Database('./data.sqlite3');

// 테이스팅 노트 있는 와인
const wineId = '3017540';
const wine = db.prepare('SELECT * FROM wines WHERE item_code = ?').get(wineId);
const note = db.prepare('SELECT * FROM tasting_notes WHERE wine_id = ?').get(wineId);

console.log('Wine:', wine?.item_name_kr);
console.log('Note exists:', !!note);
console.log('Note fields:', note ? Object.keys(note).filter(k => note[k]).join(', ') : 'N/A');

// 헬퍼
function formatVintage4(v) {
  if (!v || v === '-') return '-';
  if (/^(NV|MV)$/i.test(v)) return v.toUpperCase();
  if (/^\d{4}$/.test(v)) return v;
  const num = parseInt(v, 10);
  if (!isNaN(num)) return num >= 50 ? `19${String(num).padStart(2, '0')}` : `20${String(num).padStart(2, '0')}`;
  return v;
}
function stripKrPrefix(name) { return name.replace(/^[A-Za-z]{2}\s+/, ''); }

const COLORS = {
  BG_CREAM: 'FAF7F2', BG_BOTTLE_AREA: 'F5F0EA',
  BURGUNDY: '722F37', BURGUNDY_DARK: '5A252C', BURGUNDY_LIGHT: 'F2E8EA',
  GOLD: 'B8976A', GOLD_LIGHT: 'D4C4A8',
  TEXT_PRIMARY: '2C2C2C', TEXT_SECONDARY: '5A5A5A', TEXT_MUTED: '8A8A8A', TEXT_ON_DARK: 'FFFFFF',
  CARD_BORDER: 'E0D5C8', CARD_SHADOW: '000000', DIVIDER: 'D4C4A8', DIVIDER_LIGHT: 'E8DDD0',
};

const pptx = new PptxGenJS();
pptx.defineLayout({ name: 'PORTRAIT', width: 7.5, height: 10.0 });
pptx.layout = 'PORTRAIT';

const slide = pptx.addSlide();
slide.background = { color: COLORS.BG_CREAM };

// 좌측 병 영역
slide.addShape('rect', { x: 0, y: 0.90, w: 2.10, h: 8.10, fill: { color: COLORS.BG_BOTTLE_AREA, transparency: 40 }, line: { width: 0 } });

// 와인명 카드
slide.addShape('roundRect', { x: 2.05, y: 0.97, w: 5.20, h: 0.76, rectRadius: 0.08, fill: { color: COLORS.BURGUNDY_LIGHT, transparency: 20 }, line: { color: COLORS.CARD_BORDER, width: 0.5 }, shadow: { type: 'outer', blur: 4, offset: 1.5, angle: 135, color: '000000', opacity: 0.08 } });

const cleanName = stripKrPrefix(wine.item_name_kr);
slide.addText(cleanName, { x: 2.20, y: 1.00, w: 4.90, h: 0.36, fontSize: 14.5, fontFace: '맑은 고딕', color: COLORS.BURGUNDY_DARK, bold: true, valign: 'bottom' });

if (wine.item_name_en) {
  slide.addText(wine.item_name_en, { x: 2.20, y: 1.36, w: 4.90, h: 0.30, fontSize: 10.5, fontFace: '맑은 고딕', color: COLORS.TEXT_SECONDARY, bold: true, italic: true, valign: 'top' });
}

// 테이스팅 노트 카드
slide.addShape('roundRect', { x: 2.05, y: 5.30, w: 5.20, h: 2.72, rectRadius: 0.08, fill: { color: COLORS.BURGUNDY_LIGHT, transparency: 30 }, line: { color: COLORS.CARD_BORDER, width: 0.5 }, shadow: { type: 'outer', blur: 4, offset: 1.5, angle: 135, color: '000000', opacity: 0.08 } });

// 테이스팅 노트 텍스트
const tastingParts = [];
const items = [
  { label: 'Color', value: note?.color_note },
  { label: 'Nose', value: note?.nose_note },
  { label: 'Palate', value: note?.palate_note },
];
let idx = 0;
for (const item of items) {
  if (!item.value) continue;
  tastingParts.push({
    text: item.label,
    options: { fontSize: 8.5, fontFace: 'Noto Sans KR', color: COLORS.BURGUNDY, bold: true, breakType: idx > 0 ? 'break' : 'none', paraSpaceBefore: idx > 0 ? 6 : 0 },
  });
  tastingParts.push({
    text: '\n' + item.value,
    options: { fontSize: 9, fontFace: '맑은 고딕', color: COLORS.TEXT_PRIMARY, breakType: 'none' },
  });
  idx++;
}
if (tastingParts.length === 0) {
  tastingParts.push({ text: '-', options: { fontSize: 9, fontFace: '맑은 고딕', color: COLORS.TEXT_MUTED } });
}
slide.addText(tastingParts, { x: 2.15, y: 5.62, w: 5.00, h: 2.32, valign: 'top', lineSpacingMultiple: 1.15 });

try {
  const output = await pptx.write({ outputType: 'nodebuffer' });
  console.log('Output type:', typeof output, output?.constructor?.name, 'length:', output.length);

  fs.writeFileSync('./output/test-full-wine.pptx', Buffer.from(output));
  const stats = fs.statSync('./output/test-full-wine.pptx');
  console.log('PPTX saved:', stats.size, 'bytes');

  // Check PPTX magic bytes
  const header = Buffer.from(output).slice(0, 4).toString('hex');
  console.log('Header (should be 504b0304):', header);
  console.log(header === '504b0304' ? 'VALID PPTX!' : 'INVALID - NOT A ZIP/PPTX FILE!');
} catch(e) {
  console.error('GENERATION ERROR:', e);
}

db.close();
