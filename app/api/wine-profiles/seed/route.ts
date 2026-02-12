import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { ensureWineProfileTable } from '@/app/lib/wineProfileDb';
import JSZip from 'jszip';

export const maxDuration = 300; // 5분 타임아웃

const TASTING_NOTE_BASE_URL = 'https://github.com/chanbap24-create/order_ai/releases/download/note';
const INDEX_URL = `${TASTING_NOTE_BASE_URL}/tasting-notes-index.json`;

async function downloadPptx(code: string): Promise<Buffer | null> {
  try {
    const url = `${TASTING_NOTE_BASE_URL}/${code}.pptx`;
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return null;
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  } catch {
    return null;
  }
}

function extractTextsFromPptx(zip: JSZip): string[] {
  const texts: string[] = [];
  const slideFiles = Object.keys(zip.files)
    .filter(f => f.startsWith('ppt/slides/slide') && f.endsWith('.xml'))
    .sort();

  // 동기적으로 처리 불가 - 이미 로드된 zip 사용
  return texts; // placeholder, 실제로는 async로 처리
}

interface WineData {
  item_code: string;
  country: string;
  region: string;
  grape_varieties: string;
  wine_type: string;
  sweetness: string;
  body: string;
  description_kr: string;
  food_pairing: string;
}

function parseWineData(itemCode: string, texts: string[]): WineData {
  const data: WineData = {
    item_code: itemCode,
    country: '',
    region: '',
    grape_varieties: '',
    wine_type: '',
    sweetness: '',
    body: '',
    description_kr: '',
    food_pairing: '',
  };

  const KEYWORDS = ['지역', '품종', '포도밭', 'COLOR', 'NOSE', 'PALATE', 'FOOD MATCHING',
    'Dry', 'Sweet', 'Light', 'Full', 'STYLE', 'BODY', '수상', '수상 내역', '특이사항'];

  // 키워드 인덱스 찾기
  const regionIdx = texts.findIndex(t => t.trim() === '지역');
  const grapeIdx = texts.findIndex(t => t.trim() === '품종');
  const vineyardIdx = texts.findIndex(t => t.trim() === '포도밭');
  const colorIdx = texts.findIndex(t => t.trim() === 'COLOR');
  const awardIdx = texts.findIndex(t => t.trim() === '수상 내역' || t.trim() === '수상');
  const specIdx = texts.findIndex(t => t.trim() === '특이사항');

  // 지역 추출
  if (regionIdx >= 0 && regionIdx + 1 < texts.length) {
    const regionText = texts[regionIdx + 1].trim();
    const parts = regionText.split(/[–\-,]/).map(s => s.trim()).filter(Boolean);
    if (parts.length >= 1) data.country = parts[0];
    if (parts.length >= 2) data.region = parts.slice(1).join(', ');
  }

  // 품종 추출: 품종 ~ 다음 키워드
  if (grapeIdx >= 0 && grapeIdx + 1 < texts.length) {
    const endIdx = texts.findIndex((t, i) => i > grapeIdx && KEYWORDS.includes(t.trim()));
    const grapeTexts = texts.slice(grapeIdx + 1, endIdx > grapeIdx ? endIdx : grapeIdx + 2);
    data.grape_varieties = grapeTexts.join(' ').replace(/\s+/g, ' ').trim();
  }

  // 설명 추출: 포도밭(또는 품종 끝) ~ COLOR 사이
  const descStart = vineyardIdx >= 0 ? vineyardIdx + 1 : (grapeIdx >= 0 ? grapeIdx + 2 : -1);
  if (descStart >= 0 && colorIdx > descStart) {
    const descTexts = texts.slice(descStart, colorIdx)
      .filter(t => t.trim() && !KEYWORDS.includes(t.trim()));
    if (descTexts.length > 0) {
      data.description_kr = descTexts.join(' ')
        .replace(/\s+/g, ' ')
        .replace(/\s*\.\s*/g, '. ')
        .replace(/\s*,\s*/g, ', ')
        .trim();
    }
  }

  // 푸드 페어링 추출: 수상 내역 이후 점수 다음 ~ 특이사항 이전
  if (awardIdx >= 0) {
    const foodStart = awardIdx + 1;
    const foodEnd = specIdx > awardIdx ? specIdx : texts.length;
    // 점수(숫자 + 점) 이후부터 음식 시작
    let actualStart = foodStart;
    for (let i = foodStart; i < foodEnd; i++) {
      if (texts[i].trim() === '점') { actualStart = i + 1; break; }
    }
    if (actualStart < foodEnd) {
      const foodTexts = texts.slice(actualStart, foodEnd)
        .filter(t => t.trim() && !KEYWORDS.includes(t.trim()));
      if (foodTexts.length > 0) {
        data.food_pairing = foodTexts.join(' ')
          .replace(/\s+/g, ' ')
          .replace(/\s*,\s*/g, ', ')
          .trim();
      }
    }
  }

  // 와인 타입 추론
  const allText = texts.join(' ').toLowerCase();
  if (allText.includes('champagne') || allText.includes('sparkling') || allText.includes('cava') || allText.includes('prosecco') || allText.includes('샴페인')) {
    data.wine_type = 'Sparkling';
  } else if (allText.includes('rosé') || allText.includes('로제')) {
    data.wine_type = 'Rose';
  } else if (allText.includes('dessert') || allText.includes('디저트') || allText.includes('port') || allText.includes('포트') || allText.includes('sherry')) {
    data.wine_type = 'Dessert';
  }
  // Red/White는 품종 기반으로도 추론
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

export async function POST() {
  try {
    ensureWineProfileTable();

    // 1. 테이스팅노트 인덱스에서 PPTX가 있는 품목코드 목록 가져오기
    const indexRes = await fetch(`${INDEX_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!indexRes.ok) {
      return NextResponse.json({ error: '테이스팅노트 인덱스를 불러올 수 없습니다.' }, { status: 500 });
    }
    const indexData = await indexRes.json();
    const notes = indexData.notes || {};

    const pptxCodes: string[] = [];
    for (const [code, info] of Object.entries(notes as Record<string, any>)) {
      if (info?.pptx) pptxCodes.push(code);
    }

    if (pptxCodes.length === 0) {
      return NextResponse.json({ success: true, message: 'PPTX 파일이 없습니다.', imported: 0 });
    }

    // 2. 이미 description_kr이 채워진 프로필은 건너뛰기
    const { data: existingRows } = await supabase
      .from('wine_profiles')
      .select('item_code')
      .or('grape_varieties.neq.,description_kr.neq.');

    const existingSet = new Set((existingRows || []).map(r => r.item_code));

    const targetCodes = pptxCodes.filter(c => !existingSet.has(c));

    // 3. 각 PPTX 다운로드 & 파싱
    let imported = 0;
    let failed = 0;
    const batchSize = 10;

    for (let i = 0; i < targetCodes.length; i += batchSize) {
      const batch = targetCodes.slice(i, i + batchSize);

      const results = await Promise.all(
        batch.map(async (code) => {
          try {
            const buf = await downloadPptx(code);
            if (!buf) return null;

            const zip = await JSZip.loadAsync(buf);
            const slideFiles = Object.keys(zip.files)
              .filter(f => f.startsWith('ppt/slides/slide') && f.endsWith('.xml'))
              .sort();

            const allTexts: string[] = [];
            for (const s of slideFiles) {
              const xml = await zip.files[s].async('string');
              const re = /<a:t>([^<]*)<\/a:t>/g;
              let m;
              while ((m = re.exec(xml)) !== null) {
                if (m[1].trim()) allTexts.push(m[1].trim());
              }
            }

            return parseWineData(code, allTexts);
          } catch {
            return null;
          }
        })
      );

      // Sequential upserts (replacing transaction)
      for (const data of results) {
        if (!data) { failed++; continue; }
        const { error } = await supabase
          .from('wine_profiles')
          .upsert({
            item_code: data.item_code,
            country: data.country,
            region: data.region,
            grape_varieties: data.grape_varieties,
            wine_type: data.wine_type,
            sweetness: data.sweetness,
            body: data.body,
            description_kr: data.description_kr,
            food_pairing: data.food_pairing,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'item_code' });

        if (error) {
          console.error(`Upsert error for ${data.item_code}:`, error);
          failed++;
        } else {
          imported++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      failed,
      skipped: existingSet.size,
      total: pptxCodes.length,
    });
  } catch (error) {
    console.error('Wine profile seed error:', error);
    return NextResponse.json(
      { error: 'Seed 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
