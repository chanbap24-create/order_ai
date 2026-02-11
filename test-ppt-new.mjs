// 신규 와인 PPT 생성 테스트 (테이스팅 노트 없는 와인)
import Database from 'better-sqlite3';
import PptxGenJS from 'pptxgenjs';
import fs from 'fs';

const db = new Database('./data.sqlite3');

// 신규 와인 (테이스팅 노트 없음)
const wineId = '3012540';
const wine = db.prepare('SELECT * FROM wines WHERE item_code = ?').get(wineId);
const note = db.prepare('SELECT * FROM tasting_notes WHERE wine_id = ?').get(wineId);

console.log('Wine:', wine?.item_name_kr, wine?.item_name_en);
console.log('Note:', note ? 'EXISTS' : 'NULL');

if (!wine) {
  console.log('Wine not found!');
  process.exit(1);
}

const pptx = new PptxGenJS();
pptx.defineLayout({ name: 'PORTRAIT', width: 7.5, height: 10.0 });
pptx.layout = 'PORTRAIT';

const slide = pptx.addSlide();
slide.background = { color: 'FAF7F2' };

// 기본 텍스트만 추가 (최소한의 테스트)
slide.addText(wine.item_name_kr || 'No name', {
  x: 2.0, y: 1.0, w: 5.0, h: 0.5,
  fontSize: 14, fontFace: '맑은 고딕', color: '2C2C2C', bold: true,
});

slide.addText('테이스팅 노트 없음', {
  x: 2.0, y: 2.0, w: 5.0, h: 0.3,
  fontSize: 10, fontFace: '맑은 고딕', color: '999999',
});

try {
  const output = await pptx.write({ outputType: 'nodebuffer' });
  console.log('Output type:', typeof output, output?.constructor?.name);
  console.log('Output length:', output?.length || output?.byteLength);

  fs.writeFileSync('./output/test-new-wine.pptx', Buffer.from(output));
  const stats = fs.statSync('./output/test-new-wine.pptx');
  console.log('File saved:', stats.size, 'bytes');
  console.log('PPTX header check:', Buffer.from(output).slice(0, 4).toString('hex'));
  // ZIP/PPTX should start with PK (50 4B)
} catch(e) {
  console.error('ERROR:', e);
}

db.close();
