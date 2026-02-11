// 로고/아이콘 이미지가 문제인지 테스트
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const PptxGenJS = (await import('pptxgenjs')).default;
const fs = await import('fs');

// pptAssets에서 로고 데이터 가져오기 (직접 읽기)
const assetsFile = fs.readFileSync('./app/lib/pptAssets.ts', 'utf8');
const logoMatch = assetsFile.match(/LOGO_CAVEDEVIN_BASE64\s*=\s*"([^"]+)"/);
const iconMatch = assetsFile.match(/ICON_AWARD_BASE64\s*=\s*"([^"]+)"/);

const LOGO_BASE64 = logoMatch ? logoMatch[1] : null;
const ICON_BASE64 = iconMatch ? iconMatch[1] : null;

console.log('Logo base64 length:', LOGO_BASE64?.length || 0);
console.log('Icon base64 length:', ICON_BASE64?.length || 0);

// base64 → Buffer 유효성 체크
if (LOGO_BASE64) {
  const buf = Buffer.from(LOGO_BASE64, 'base64');
  console.log('Logo decoded bytes:', buf.length, '| JPEG header:', buf.slice(0,2).toString('hex') === 'ffd8' ? 'VALID' : 'INVALID');
}
if (ICON_BASE64) {
  const buf = Buffer.from(ICON_BASE64, 'base64');
  console.log('Icon decoded bytes:', buf.length, '| JPEG header:', buf.slice(0,2).toString('hex') === 'ffd8' ? 'VALID' : 'INVALID');
}

const LOGO_DATA = `image/jpeg;base64,${LOGO_BASE64}`;
const ICON_DATA = `image/jpeg;base64,${ICON_BASE64}`;

// === 테스트 1: 로고만 ===
const pptx1 = new PptxGenJS();
pptx1.defineLayout({ name: 'P', width: 7.5, height: 10.0 });
pptx1.layout = 'P';
const s1 = pptx1.addSlide();
s1.background = { color: 'FAF7F2' };
s1.addText('Logo Test', { x: 2, y: 1, w: 4, h: 0.5, fontSize: 20, bold: true });
try {
  s1.addImage({ data: LOGO_DATA, x: 0.20, y: 0.20, w: 1.49, h: 0.57 });
  console.log('\nLogo image added OK');
} catch (e) {
  console.log('\nLogo image FAILED:', e.message);
}
const out1 = await pptx1.write({ outputType: 'nodebuffer' });
fs.writeFileSync('output/test-logo-only.pptx', Buffer.from(out1));
console.log('Saved: output/test-logo-only.pptx (' + out1.length + ' bytes)');

// === 테스트 2: 아이콘만 ===
const pptx2 = new PptxGenJS();
pptx2.defineLayout({ name: 'P', width: 7.5, height: 10.0 });
pptx2.layout = 'P';
const s2 = pptx2.addSlide();
s2.background = { color: 'FAF7F2' };
s2.addText('Icon Test', { x: 2, y: 1, w: 4, h: 0.5, fontSize: 20, bold: true });
try {
  s2.addImage({ data: ICON_DATA, x: 0.25, y: 2.0, w: 0.22, h: 0.28 });
  console.log('Icon image added OK');
} catch (e) {
  console.log('Icon image FAILED:', e.message);
}
const out2 = await pptx2.write({ outputType: 'nodebuffer' });
fs.writeFileSync('output/test-icon-only.pptx', Buffer.from(out2));
console.log('Saved: output/test-icon-only.pptx (' + out2.length + ' bytes)');

// === 테스트 3: 둘 다 없음 (와인만) ===
const pptx3 = new PptxGenJS();
pptx3.defineLayout({ name: 'P', width: 7.5, height: 10.0 });
pptx3.layout = 'P';
const s3 = pptx3.addSlide();
s3.background = { color: 'FAF7F2' };
s3.addText('No Logo/Icon Test', { x: 2, y: 1, w: 4, h: 0.5, fontSize: 20, bold: true });
s3.addShape('roundRect', { x: 2.05, y: 2, w: 5.20, h: 0.76, rectRadius: 0.08, fill: { color: 'F2E8EA', transparency: 20 }, line: { color: 'E0D5C8', width: 0.5 } });
const out3 = await pptx3.write({ outputType: 'nodebuffer' });
fs.writeFileSync('output/test-no-logo.pptx', Buffer.from(out3));
console.log('Saved: output/test-no-logo.pptx (' + out3.length + ' bytes)');

console.log('\n=== 세 파일 모두 PowerPoint에서 열어보세요 ===');
console.log('1. output/test-logo-only.pptx  (로고만)');
console.log('2. output/test-icon-only.pptx  (아이콘만)');
console.log('3. output/test-no-logo.pptx    (둘 다 없음)');
