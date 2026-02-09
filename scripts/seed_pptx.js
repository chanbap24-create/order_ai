const Database = require('better-sqlite3');
const JSZip = require('jszip');
const https = require('https');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'data.sqlite3'));

const TASTING_NOTE_BASE_URL = 'https://github.com/chanbap24-create/order_ai/releases/download/note';
const INDEX_URL = `${TASTING_NOTE_BASE_URL}/tasting-notes-index.json`;

const KEYWORDS = ['지역', '품종', '포도밭', 'COLOR', 'NOSE', 'PALATE', 'FOOD MATCHING',
  'Dry', 'Sweet', 'Light', 'Full', 'STYLE', 'BODY', '수상', '수상 내역', '특이사항'];

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'node' } }, res => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        download(res.headers.location).then(resolve).catch(reject);
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function parseWineData(itemCode, texts) {
  const data = { item_code: itemCode, country: '', region: '', grape_varieties: '', wine_type: '', description_kr: '', food_pairing: '' };

  const regionIdx = texts.findIndex(t => t === '지역');
  const grapeIdx = texts.findIndex(t => t === '품종');
  const vineyardIdx = texts.findIndex(t => t === '포도밭');
  const colorIdx = texts.findIndex(t => t === 'COLOR');
  const awardIdx = texts.findIndex(t => t === '수상 내역' || t === '수상');
  const specIdx = texts.findIndex(t => t === '특이사항');

  // 지역
  if (regionIdx >= 0 && regionIdx + 1 < texts.length) {
    const regionText = texts[regionIdx + 1];
    const parts = regionText.split(/[–\-,]/).map(s => s.trim()).filter(Boolean);
    if (parts.length >= 1) data.country = parts[0];
    if (parts.length >= 2) data.region = parts.slice(1).join(', ');
  }

  // 품종
  if (grapeIdx >= 0 && grapeIdx + 1 < texts.length) {
    const endIdx = texts.findIndex((t, i) => i > grapeIdx && KEYWORDS.includes(t));
    const grapeTexts = texts.slice(grapeIdx + 1, endIdx > grapeIdx ? endIdx : grapeIdx + 2);
    let grapeStr = grapeTexts.join(' ').replace(/\s+/g, ' ').trim();
    // 와이너리 설명이나 음식으로 시작하는 경우 품종 데이터 아님
    const descStarters = /^(빈티지|숙성|와인|와이너리|해발|포도밭|연간|가장|설립|생산|수확|LA\s|갈비|스테이크|치즈|해산물|파스타|닭|소고기|돼지|양고기|Cheese)/i;
    if (descStarters.test(grapeStr)) {
      grapeStr = '';
    } else {
      // 회사 정보/연락처/설명 이후 텍스트 제거
      const cutPatterns = [/㈜/, /\(주\)/, /T\.\s*\d{2,3}-/, /www\./, /http/, /양조/, /수상/, /테이스팅/, /푸드\s*페어링/, /글라스\s*페어링/, /해발\s*고도/, /포도밭은/, /포도밭의/, /에서\s*재배/, /토양은/, /에서\s*생산/, /\s+[\u2013\u2014\-]+\s+[\uAC00-\uD7AF]/];
      for (const pat of cutPatterns) {
        const m = grapeStr.search(pat);
        if (m >= 0) { grapeStr = grapeStr.substring(0, m).trim(); break; }
      }
      // 끝 쉼표/공백 정리
      grapeStr = grapeStr.replace(/[,\s]+$/, '').trim();
    }
    data.grape_varieties = grapeStr;
  }

  // 설명: 포도밭(또는 품종 끝) ~ COLOR
  const descStart = vineyardIdx >= 0 ? vineyardIdx + 1 : (grapeIdx >= 0 ? grapeIdx + 2 : -1);
  if (descStart >= 0 && colorIdx > descStart) {
    const descTexts = texts.slice(descStart, colorIdx).filter(t => t && !KEYWORDS.includes(t));
    if (descTexts.length > 0) {
      data.description_kr = descTexts.join(' ').replace(/\s+/g, ' ').replace(/\s*\.\s*/g, '. ').replace(/\s*,\s*/g, ', ').trim();
    }
  }

  // 푸드 페어링: 수상 내역 이후 점수 다음 ~ 특이사항
  if (awardIdx >= 0) {
    const foodEnd = specIdx > awardIdx ? specIdx : texts.length;
    let actualStart = awardIdx + 1;
    for (let i = awardIdx + 1; i < foodEnd; i++) {
      if (texts[i] === '점') { actualStart = i + 1; break; }
    }
    if (actualStart < foodEnd) {
      const foodTexts = texts.slice(actualStart, foodEnd).filter(t => t && !KEYWORDS.includes(t));
      if (foodTexts.length > 0) {
        data.food_pairing = foodTexts.join(' ').replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').trim();
      }
    }
  }

  // 와인 타입
  const allText = texts.join(' ').toLowerCase();
  if (allText.includes('champagne') || allText.includes('sparkling') || allText.includes('cava') || allText.includes('prosecco') || allText.includes('샴페인')) {
    data.wine_type = 'Sparkling';
  } else if (allText.includes('rosé') || allText.includes('로제')) {
    data.wine_type = 'Rose';
  } else if (allText.includes('dessert') || allText.includes('디저트') || allText.includes('sherry')) {
    data.wine_type = 'Dessert';
  }
  if (!data.wine_type) {
    const grapes = data.grape_varieties.toLowerCase();
    const redGrapes = ['cabernet', 'merlot', 'pinot noir', 'syrah', 'shiraz', 'tempranillo', 'sangiovese', 'nebbiolo', 'malbec', 'grenache', 'garnacha', 'zinfandel', 'mourvèdre', 'mourvedre', 'carmenere', 'pinotage'];
    const whiteGrapes = ['chardonnay', 'sauvignon blanc', 'riesling', 'pinot grigio', 'pinot gris', 'gewurztraminer', 'viognier', 'chenin blanc', 'semillon', 'muscat', 'moscato', 'albariño', 'albarino', 'gruner veltliner', 'torrontes'];
    const hasRed = redGrapes.some(g => grapes.includes(g));
    const hasWhite = whiteGrapes.some(g => grapes.includes(g));
    if (hasRed && !hasWhite) data.wine_type = 'Red';
    else if (hasWhite && !hasRed) data.wine_type = 'White';
  }

  return data;
}

async function main() {
  // GitHub API로 릴리즈 에셋에서 PPTX 파일 목록 가져오기
  console.log('Fetching release assets from GitHub API...');
  const apiBuf = await download('https://api.github.com/repos/chanbap24-create/order_ai/releases/tags/note');
  const releaseData = JSON.parse(apiBuf.toString());
  const assets = releaseData.assets || [];

  const pptxCodes = [];
  for (const asset of assets) {
    if (asset.name.endsWith('.pptx')) {
      pptxCodes.push(asset.name.replace('.pptx', ''));
    }
  }
  console.log(`Found ${pptxCodes.length} PPTX files`);

  const stmt = db.prepare(`
    UPDATE wine_profiles SET
      country = CASE WHEN @country != '' THEN @country ELSE country END,
      region = CASE WHEN @region != '' THEN @region ELSE region END,
      grape_varieties = @grape_varieties,
      wine_type = CASE WHEN @wine_type != '' THEN @wine_type ELSE wine_type END,
      description_kr = @description_kr,
      food_pairing = @food_pairing,
      updated_at = datetime('now')
    WHERE item_code = @item_code
  `);

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO wine_profiles (item_code, country, region, grape_varieties, wine_type, description_kr, food_pairing)
    VALUES (@item_code, @country, @region, @grape_varieties, @wine_type, @description_kr, @food_pairing)
  `);

  let imported = 0;
  let failed = 0;
  const batchSize = 10;

  for (let i = 0; i < pptxCodes.length; i += batchSize) {
    const batch = pptxCodes.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(async (code) => {
      try {
        const url = `${TASTING_NOTE_BASE_URL}/${code}.pptx`;
        const buf = await download(url);
        const zip = await JSZip.loadAsync(buf);
        const slideFiles = Object.keys(zip.files).filter(f => f.startsWith('ppt/slides/slide') && f.endsWith('.xml')).sort();
        const allTexts = [];
        for (const s of slideFiles) {
          const xml = await zip.files[s].async('string');
          const re = /<a:t>([^<]*)<\/a:t>/g;
          let m;
          while (m = re.exec(xml)) { if (m[1].trim()) allTexts.push(m[1].trim()); }
        }
        return parseWineData(code, allTexts);
      } catch (e) {
        return null;
      }
    }));

    db.transaction(() => {
      for (const data of results) {
        if (!data) { failed++; continue; }
        // Update existing or insert new
        const r = stmt.run(data);
        if (r.changes === 0) {
          insertStmt.run(data);
        }
        imported++;
      }
    })();

    process.stdout.write(`\r  ${Math.min(i + batchSize, pptxCodes.length)}/${pptxCodes.length} processed...`);
  }

  console.log(`\nDone! Imported: ${imported}, Failed: ${failed}`);

  // 결과 확인
  const withGrape = db.prepare("SELECT COUNT(*) as cnt FROM wine_profiles WHERE grape_varieties != ''").get();
  const withDesc = db.prepare("SELECT COUNT(*) as cnt FROM wine_profiles WHERE description_kr != ''").get();
  console.log(`Profiles with grape_varieties: ${withGrape.cnt}`);
  console.log(`Profiles with description_kr: ${withDesc.cnt}`);

  // quote items 확인
  try {
    const quoteItems = db.prepare('SELECT item_code FROM quote_items').all();
    console.log(`\nQuote items check (${quoteItems.length}):`);
    for (const qi of quoteItems) {
      const wp = db.prepare('SELECT grape_varieties, description_kr FROM wine_profiles WHERE item_code = ?').get(qi.item_code);
      console.log(`  ${qi.item_code}: grape=[${(wp?.grape_varieties||'').substring(0,40)}] desc=[${(wp?.description_kr||'').substring(0,40)}]`);
    }
  } catch {}

  db.close();
}

main().catch(e => { console.error(e); process.exit(1); });
