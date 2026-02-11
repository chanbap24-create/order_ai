// PPT 생성 디버그 테스트 - 실제 pptGenerator 로직 전체 실행
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// better-sqlite3로 직접 DB 접근
const Database = require('better-sqlite3');
const db = new Database('./data.sqlite3');

const wineId = '3017540';
const wine = db.prepare('SELECT * FROM wines WHERE item_code = ?').get(wineId);
const note = db.prepare('SELECT * FROM tasting_notes WHERE wine_id = ?').get(wineId);
console.log('Wine:', wine.item_name_kr, '| EN:', wine.item_name_en);
console.log('Has note:', !!note);
console.log('Image URL:', wine.image_url);

// 이미지 다운로드 테스트
async function downloadImage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  if (!res.ok) return null;
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await res.arrayBuffer());
  return { base64: buffer.toString('base64'), mimeType: contentType.split(';')[0] };
}

// Vivino 검색 테스트
async function searchVivino(name) {
  const queries = [name];
  const words = name.split(/\s+/);
  if (words.length > 3) queries.push(words.slice(0, Math.ceil(words.length * 0.6)).join(' '));
  if (words.length > 2) queries.push(words.slice(0, 3).join(' '));

  for (const q of queries) {
    try {
      const res = await fetch(`https://www.vivino.com/search/wines?q=${encodeURIComponent(q)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      if (!res.ok) continue;
      const html = await res.text();
      const pbMatch = html.match(/\/\/images\.vivino\.com\/thumbs\/[A-Za-z0-9_+-]+_pb_x960\.png/)
                    || html.match(/\/\/images\.vivino\.com\/thumbs\/[A-Za-z0-9_+-]+_pb_x600\.png/)
                    || html.match(/\/\/images\.vivino\.com\/thumbs\/[A-Za-z0-9_+-]+_pb_[A-Za-z0-9x]+\.png/);
      if (pbMatch) return `https:${pbMatch[0]}`;
    } catch {}
  }
  return null;
}

// 메인 테스트
const PptxGenJS = (await import('pptxgenjs')).default;
const fs = await import('fs');

let bottleBase64 = null;
let bottleMime = null;

// 1. Vivino 시도
console.log('\n--- Vivino search ---');
const vivinoUrl = await searchVivino(wine.item_name_en);
console.log('Vivino URL:', vivinoUrl || 'NOT FOUND');

if (vivinoUrl) {
  const img = await downloadImage(vivinoUrl);
  if (img) {
    bottleBase64 = img.base64;
    bottleMime = img.mimeType;
    console.log('Vivino image:', bottleMime, 'base64 length:', bottleBase64.length);
  }
}

// 2. DB URL fallback
if (!bottleBase64 && wine.image_url) {
  console.log('\n--- DB image fallback ---');
  const img = await downloadImage(wine.image_url);
  if (img) {
    bottleBase64 = img.base64;
    bottleMime = img.mimeType;
    console.log('DB image:', bottleMime, 'base64 length:', bottleBase64.length);
  }
}

// 3. PPT 생성
console.log('\n--- Generating PPT ---');
console.log('Image MIME for PPT:', bottleMime || 'NO IMAGE');

const pptx = new PptxGenJS();
pptx.defineLayout({ name: 'PORTRAIT', width: 7.5, height: 10.0 });
pptx.layout = 'PORTRAIT';
const slide = pptx.addSlide();
slide.background = { color: 'FAF7F2' };

// 기본 텍스트
slide.addText(wine.item_name_kr, {
  x: 2.2, y: 1.0, w: 4.9, h: 0.36,
  fontSize: 14, fontFace: '맑은 고딕', color: '2C2C2C', bold: true,
});

// 이미지 추가 (실제 코드와 동일한 방식)
if (bottleBase64) {
  const mime = bottleMime || 'image/png';
  const dataUri = `${mime};base64,${bottleBase64}`;
  console.log('Data URI prefix:', dataUri.substring(0, 40) + '...');

  try {
    slide.addImage({
      data: dataUri,
      x: 0.3, y: 2.2, w: 1.5, h: 5.8,
      sizing: { type: 'contain', w: 1.5, h: 5.8 },
    });
    console.log('Image added to slide OK');
  } catch (e) {
    console.error('Image add FAILED:', e.message);
  }
}

try {
  const output = await pptx.write({ outputType: 'nodebuffer' });
  const buf = Buffer.from(output);
  console.log('\nOutput size:', buf.length, 'bytes');
  console.log('Header:', buf.slice(0, 4).toString('hex'), buf.slice(0, 4).toString('hex') === '504b0304' ? '✓ VALID ZIP/PPTX' : '✗ INVALID');

  fs.writeFileSync('./output/test-debug.pptx', buf);
  console.log('Saved: output/test-debug.pptx');
  console.log('\n>>> 이 파일을 PowerPoint로 열어보세요 <<<');
} catch (e) {
  console.error('PPT write FAILED:', e.message);
}

db.close();
