/**
 * PPTX에서 와인병 이미지 추출 스크립트
 *
 * GitHub 릴리즈(tag: note)의 PPTX 파일에서 와인병 이미지를 추출하여
 * public/bottle-images/ 에 저장하고, SQLite DB에 메타데이터를 기록합니다.
 *
 * Usage: node scripts/extract-bottle-images.js
 */

const fetch = require('node-fetch');
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');
const { imageSize } = require('image-size');
const Database = require('better-sqlite3');

const RELEASE_API = 'https://api.github.com/repos/chanbap24-create/order_ai/releases/tags/note';
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'bottle-images');
const DB_PATH = path.join(__dirname, '..', 'data.sqlite3');

// 와인병 이미지 판별 기준: 세로비율 > 1.3, 파일크기 > 30KB
const MIN_RATIO = 1.3;
const MIN_SIZE_KB = 30;

// 동시 다운로드 수
const CONCURRENCY = 5;

async function main() {
  console.log('=== 와인병 이미지 추출 스크립트 ===\n');

  // 1. 출력 디렉토리 생성
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // 2. DB 테이블 생성
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS bottle_images (
      item_code TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      size_kb INTEGER,
      source_image TEXT,
      extracted_at TEXT DEFAULT (datetime('now'))
    )
  `);
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO bottle_images (item_code, filename, width, height, size_kb, source_image)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // 3. GitHub 릴리즈에서 PPTX 목록 가져오기
  console.log('GitHub 릴리즈에서 PPTX 목록 조회 중...');
  const res = await fetch(RELEASE_API);
  if (!res.ok) {
    console.error('릴리즈 조회 실패:', res.status);
    process.exit(1);
  }
  const release = await res.json();
  const pptxAssets = release.assets.filter(a => a.name.endsWith('.pptx'));
  console.log(`PPTX 파일 ${pptxAssets.length}개 발견\n`);

  // 4. 이미 추출된 항목 확인 (스킵용)
  const existing = new Set(
    db.prepare('SELECT item_code FROM bottle_images').all().map(r => r.item_code)
  );
  const toProcess = pptxAssets.filter(a => !existing.has(path.basename(a.name, '.pptx')));
  console.log(`이미 추출됨: ${existing.size}개, 신규 처리: ${toProcess.length}개\n`);

  if (toProcess.length === 0) {
    console.log('모든 파일이 이미 처리되었습니다.');
    db.close();
    return;
  }

  // 5. 배치 처리
  let success = 0;
  let noBottle = 0;
  let failed = 0;

  for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
    const batch = toProcess.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(asset => processOne(asset, insertStmt))
    );

    results.forEach((r, idx) => {
      const code = path.basename(batch[idx].name, '.pptx');
      if (r.status === 'fulfilled') {
        if (r.value) {
          success++;
          process.stdout.write(`  [${success + noBottle + failed}/${toProcess.length}] ${code} -> ${r.value}\n`);
        } else {
          noBottle++;
          process.stdout.write(`  [${success + noBottle + failed}/${toProcess.length}] ${code} -> 와인병 없음\n`);
        }
      } else {
        failed++;
        process.stdout.write(`  [${success + noBottle + failed}/${toProcess.length}] ${code} -> ERROR: ${r.reason?.message}\n`);
      }
    });
  }

  db.close();

  console.log(`\n=== 완료 ===`);
  console.log(`추출 성공: ${success}개`);
  console.log(`와인병 없음: ${noBottle}개`);
  console.log(`실패: ${failed}개`);
  console.log(`저장 위치: ${OUTPUT_DIR}`);
}

async function processOne(asset, insertStmt) {
  const itemCode = path.basename(asset.name, '.pptx');
  const url = asset.browser_download_url;

  // 다운로드
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  // PPTX 열기 (ZIP)
  const zip = new AdmZip(buffer);
  const images = zip.getEntries().filter(e => e.entryName.startsWith('ppt/media/'));

  // 와인병 이미지 찾기: ratio > 1.3, size > 30KB, 가장 높은 ratio 선택
  let best = null;

  for (const img of images) {
    const buf = img.getData();
    const sizeKB = Math.round(buf.length / 1024);
    if (sizeKB < MIN_SIZE_KB) continue;

    try {
      const dim = imageSize(buf);
      if (!dim.width || !dim.height) continue;
      const ratio = dim.height / dim.width;

      if (ratio > MIN_RATIO) {
        if (!best || ratio > best.ratio || (ratio === best.ratio && sizeKB > best.sizeKB)) {
          best = {
            entry: img,
            buf,
            ratio,
            sizeKB,
            width: dim.width,
            height: dim.height,
            type: dim.type,
            sourceName: path.basename(img.entryName),
          };
        }
      }
    } catch (e) {
      // skip unreadable images
    }
  }

  if (!best) return null;

  // 저장 (원본 포맷 유지)
  const ext = best.type === 'jpg' ? 'jpg' : best.type === 'jpeg' ? 'jpg' : best.type || 'png';
  const filename = `${itemCode}.${ext}`;
  const outPath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(outPath, best.buf);

  // DB 저장
  insertStmt.run(itemCode, filename, best.width, best.height, best.sizeKB, best.sourceName);

  return filename;
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
