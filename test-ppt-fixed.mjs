// PPT 생성 테스트 - rectRadius fix 적용
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const PptxGenJS = (await import('pptxgenjs')).default;
const Database = require('better-sqlite3');
const fs = await import('fs');

const db = new Database('./data.sqlite3');

// 와인 데이터 조회
const wines = db.prepare('SELECT * FROM wines WHERE ai_researched = 1 LIMIT 1').all();
if (!wines.length) { console.log('No researched wines'); process.exit(1); }
const wine = wines[0];
console.log('Wine:', wine.item_code, wine.item_name_kr);

const note = db.prepare('SELECT * FROM tasting_notes WHERE wine_id = ?').get(wine.item_code);
console.log('Has note:', !!note);

const COLORS = {
  BG_CREAM: 'FAF7F2', BG_BOTTLE_AREA: 'F5F0EA',
  BURGUNDY: '722F37', BURGUNDY_DARK: '5A252C', BURGUNDY_LIGHT: 'F2E8EA',
  GOLD: 'B8976A', GOLD_LIGHT: 'D4C4A8',
  TEXT_PRIMARY: '2C2C2C', TEXT_SECONDARY: '5A5A5A', TEXT_MUTED: '8A8A8A', TEXT_ON_DARK: 'FFFFFF',
  CARD_BORDER: 'E0D5C8', CARD_SHADOW: '000000', DIVIDER: 'D4C4A8', DIVIDER_LIGHT: 'E8DDD0',
};
const FONT_MAIN = '맑은 고딕';
const FONT_EN = 'Noto Sans KR';
const CARD_RADIUS = 0.08;
const LABEL_BADGE_RADIUS = 0.04;

const pptx = new PptxGenJS();
pptx.defineLayout({ name: 'PORTRAIT', width: 7.5, height: 10.0 });
pptx.layout = 'PORTRAIT';
const slide = pptx.addSlide();
slide.background = { color: COLORS.BG_CREAM };

// 좌측 병 영역 배경
slide.addShape('rect', { x: 0, y: 0.90, w: 2.10, h: 8.10, fill: { color: COLORS.BG_BOTTLE_AREA, transparency: 40 }, line: { width: 0 } });

// 우측 상단 악센트바
slide.addShape('roundRect', { x: 7.15, y: 0.20, w: 0.06, h: 0.57, fill: { color: COLORS.BURGUNDY }, line: { width: 0 }, rectRadius: 0.03 });

// 헤더 구분선
slide.addShape('line', { x: 0.20, y: 0.84, w: 7.10, h: 0, line: { color: COLORS.BURGUNDY, width: 0.75 } });
slide.addShape('line', { x: 0.20, y: 0.87, w: 7.10, h: 0, line: { color: COLORS.GOLD_LIGHT, width: 0.75 } });

// 와인명 카드
slide.addShape('roundRect', { x: 2.05, y: 0.97, w: 5.20, h: 0.76, rectRadius: CARD_RADIUS, fill: { color: COLORS.BURGUNDY_LIGHT, transparency: 20 }, line: { color: COLORS.CARD_BORDER, width: 0.5 } });

// 와인명 악센트바
slide.addShape('roundRect', { x: 2.05, y: 1.01, w: 0.05, h: 0.68, fill: { color: COLORS.BURGUNDY }, line: { width: 0 }, rectRadius: 0.025 });

// 한글명
const nameKr = (wine.item_name_kr || '').replace(/^[A-Za-z]{2}\s+/, '');
slide.addText(nameKr, { x: 2.20, y: 1.00, w: 4.90, h: 0.36, fontSize: 14.5, fontFace: FONT_MAIN, color: COLORS.BURGUNDY_DARK, bold: true, valign: 'bottom' });

// 영문명
if (wine.item_name_en) {
  slide.addText(wine.item_name_en, { x: 2.20, y: 1.36, w: 4.90, h: 0.30, fontSize: 10.5, fontFace: FONT_MAIN, color: COLORS.TEXT_SECONDARY, bold: true, italic: true, valign: 'top' });
}

// 다이아몬드 장식
slide.addShape('diamond', { x: 4.62, y: 1.79, w: 0.07, h: 0.07, fill: { color: COLORS.GOLD }, line: { width: 0 } });
slide.addShape('line', { x: 2.20, y: 1.82, w: 4.90, h: 0, line: { color: COLORS.DIVIDER, width: 0.75 } });

// 지역 & 품종 카드
slide.addShape('roundRect', { x: 2.05, y: 1.92, w: 5.20, h: 0.95, rectRadius: CARD_RADIUS, fill: { color: 'FFFFFF', transparency: 15 }, line: { color: COLORS.CARD_BORDER, width: 0.5 } });

// 지역 라벨 (roundRect + text overlay)
slide.addShape('roundRect', { x: 2.12, y: 1.97, w: 0.55, h: 0.22, fill: { color: COLORS.BURGUNDY }, rectRadius: LABEL_BADGE_RADIUS, line: { width: 0 } });
slide.addText('  지역  ', { x: 2.12, y: 1.97, w: 0.55, h: 0.22, color: COLORS.TEXT_ON_DARK, fontSize: 8.5, fontFace: FONT_MAIN, bold: true, align: 'center', valign: 'middle' });

const regionText = wine.region ? `${wine.country_en || wine.country || ''}, ${wine.region}` : (wine.country_en || wine.country || '-');
slide.addText(regionText, { x: 2.75, y: 1.96, w: 4.40, h: 0.24, fontSize: 9.5, fontFace: FONT_MAIN, color: COLORS.TEXT_PRIMARY, wrap: true });

// 구분선
slide.addShape('line', { x: 2.20, y: 2.35, w: 4.90, h: 0, line: { color: COLORS.DIVIDER_LIGHT, width: 0.75 } });

// 품종 라벨
slide.addShape('roundRect', { x: 2.12, y: 2.42, w: 0.55, h: 0.22, fill: { color: COLORS.BURGUNDY }, rectRadius: LABEL_BADGE_RADIUS, line: { width: 0 } });
slide.addText('  품종  ', { x: 2.12, y: 2.42, w: 0.55, h: 0.22, color: COLORS.TEXT_ON_DARK, fontSize: 8.5, fontFace: FONT_MAIN, bold: true, align: 'center', valign: 'middle' });
slide.addText(wine.grape_varieties || '-', { x: 2.75, y: 2.41, w: 4.40, h: 0.40, fontSize: 9.5, fontFace: FONT_MAIN, color: COLORS.TEXT_PRIMARY, wrap: true, valign: 'top' });

// 빈티지 카드
slide.addShape('roundRect', { x: 2.05, y: 2.96, w: 5.20, h: 0.50, rectRadius: CARD_RADIUS, fill: { color: 'FFFFFF', transparency: 15 }, line: { color: COLORS.CARD_BORDER, width: 0.5 } });

slide.addShape('roundRect', { x: 2.12, y: 3.02, w: 0.65, h: 0.22, fill: { color: COLORS.BURGUNDY }, rectRadius: LABEL_BADGE_RADIUS, line: { width: 0 } });
slide.addText(' 빈티지 ', { x: 2.12, y: 3.02, w: 0.65, h: 0.22, color: COLORS.TEXT_ON_DARK, fontSize: 8.5, fontFace: FONT_MAIN, bold: true, align: 'center', valign: 'middle' });

slide.addText(wine.vintage || '-', { x: 2.85, y: 2.98, w: 0.75, h: 0.28, fontSize: 13, fontFace: FONT_MAIN, color: COLORS.BURGUNDY, bold: true });

// 양조 카드
slide.addShape('roundRect', { x: 2.05, y: 3.56, w: 5.20, h: 1.65, rectRadius: CARD_RADIUS, fill: { color: 'FFFFFF', transparency: 15 }, line: { color: COLORS.CARD_BORDER, width: 0.5 } });

slide.addShape('roundRect', { x: 2.12, y: 3.62, w: 0.55, h: 0.22, fill: { color: COLORS.BURGUNDY }, rectRadius: LABEL_BADGE_RADIUS, line: { width: 0 } });
slide.addText('  양조  ', { x: 2.12, y: 3.62, w: 0.55, h: 0.22, color: COLORS.TEXT_ON_DARK, fontSize: 8.5, fontFace: FONT_MAIN, bold: true, align: 'center', valign: 'middle' });

const winemaking = note?.winemaking || '-';
const alcohol = wine.alcohol ? `\n알코올: ${wine.alcohol}` : '';
slide.addText(winemaking + alcohol, { x: 2.15, y: 3.90, w: 5.00, h: 1.23, fontSize: 9, fontFace: FONT_MAIN, color: COLORS.TEXT_PRIMARY, valign: 'top', wrap: true, lineSpacingMultiple: 1.2 });

// 테이스팅 노트 카드
slide.addShape('roundRect', { x: 2.05, y: 5.30, w: 5.20, h: 2.72, rectRadius: CARD_RADIUS, fill: { color: COLORS.BURGUNDY_LIGHT, transparency: 30 }, line: { color: COLORS.CARD_BORDER, width: 0.5 } });

// TASTING NOTE 라벨
slide.addShape('roundRect', { x: 2.12, y: 5.35, w: 1.32, h: 0.22, fill: { color: COLORS.BURGUNDY }, rectRadius: LABEL_BADGE_RADIUS, line: { width: 0 } });
slide.addText('  TASTING NOTE  ', { x: 2.12, y: 5.35, w: 1.32, h: 0.22, color: COLORS.TEXT_ON_DARK, fontSize: 7.5, fontFace: FONT_EN, bold: true, align: 'center', valign: 'middle' });

// 테이스팅 노트
const tastingParts = [];
const items = [
  { label: 'Color', value: note?.color_note },
  { label: 'Nose', value: note?.nose_note },
  { label: 'Palate', value: note?.palate_note },
  { label: 'Potential', value: note?.aging_potential },
  { label: 'Serving', value: note?.serving_temp },
];
let idx = 0;
for (const item of items) {
  if (!item.value) continue;
  tastingParts.push({ text: item.label, options: { fontSize: 8.5, fontFace: FONT_EN, color: COLORS.BURGUNDY, bold: true, breakType: idx > 0 ? 'break' : 'none', paraSpaceBefore: idx > 0 ? 6 : 0 } });
  tastingParts.push({ text: '\n' + item.value, options: { fontSize: 9, fontFace: FONT_MAIN, color: COLORS.TEXT_PRIMARY, breakType: 'none' } });
  idx++;
}
if (tastingParts.length === 0) tastingParts.push({ text: '-', options: { fontSize: 9, fontFace: FONT_MAIN, color: COLORS.TEXT_MUTED } });
slide.addText(tastingParts, { x: 2.15, y: 5.62, w: 5.00, h: 2.32, valign: 'top', lineSpacingMultiple: 1.15 });

// 푸드 페어링 카드
slide.addShape('roundRect', { x: 2.05, y: 8.12, w: 5.20, h: 0.80, rectRadius: CARD_RADIUS, fill: { color: 'FFFFFF', transparency: 15 }, line: { color: COLORS.CARD_BORDER, width: 0.5 } });

slide.addShape('roundRect', { x: 2.12, y: 8.18, w: 0.95, h: 0.22, fill: { color: COLORS.BURGUNDY }, rectRadius: LABEL_BADGE_RADIUS, line: { width: 0 } });
slide.addText('푸드 페어링', { x: 2.12, y: 8.18, w: 0.95, h: 0.22, color: COLORS.TEXT_ON_DARK, fontSize: 8.5, fontFace: FONT_MAIN, bold: true, align: 'center', valign: 'middle' });
slide.addText(note?.food_pairing || '-', { x: 2.15, y: 8.42, w: 5.00, h: 0.44, fontSize: 9, fontFace: FONT_MAIN, color: COLORS.TEXT_PRIMARY, wrap: true, valign: 'top', lineSpacingMultiple: 1.2 });

// 수상내역
slide.addShape('roundRect', { x: 0.15, y: 9.04, w: 7.20, h: 0.38, rectRadius: 0.04, fill: { color: COLORS.GOLD, transparency: 85 }, line: { color: COLORS.GOLD_LIGHT, width: 0.5 } });
slide.addText([
  { text: 'AWARDS  ', options: { fontSize: 8, fontFace: FONT_EN, color: COLORS.GOLD, bold: true } },
  { text: (note?.awards && note.awards !== 'N/A') ? note.awards : '', options: { fontSize: 9, fontFace: FONT_MAIN, color: COLORS.TEXT_PRIMARY } },
], { x: 0.52, y: 9.07, w: 6.70, h: 0.30, valign: 'middle' });

// Footer
slide.addShape('line', { x: 0.20, y: 9.52, w: 7.10, h: 0, line: { color: COLORS.BURGUNDY, width: 2.0 } });
slide.addShape('line', { x: 0.20, y: 9.55, w: 7.10, h: 0, line: { color: COLORS.GOLD_LIGHT, width: 0.75 } });
slide.addText('T. 02-786-3136  |  www.cavedevin.co.kr', { x: 1.12, y: 9.69, w: 2.76, h: 0.24, fontSize: 7, fontFace: FONT_EN, color: COLORS.TEXT_MUTED, align: 'right' });
slide.addShape('diamond', { x: 7.17, y: 9.77, w: 0.06, h: 0.06, fill: { color: COLORS.GOLD }, line: { width: 0 } });

const output = await pptx.write({ outputType: 'nodebuffer' });
const buf = Buffer.from(output);
fs.writeFileSync('output/test-wine-fixed.pptx', buf);
console.log(`\nSaved: output/test-wine-fixed.pptx (${buf.length} bytes)`);

db.close();
