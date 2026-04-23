import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

// ═══ Supabase 전체 행 가져오기 (1000행 제한 우회) ═══
async function fetchAll<T>(table: string, select: string): Promise<T[]> {
  const all: T[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// inventory_cdv 를 재고 있는 품목만 서버에서 필터
async function fetchInventoryInStock<T>(select: string): Promise<T[]> {
  const all: T[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('inventory_cdv')
      .select(select)
      .or('available_stock.gt.0,bonded_warehouse.gt.0')
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// wines 를 주어진 item_code 집합으로 한정 조회
async function fetchWinesByCodes<T>(codes: string[], select: string): Promise<T[]> {
  if (codes.length === 0) return [];
  const all: T[] = [];
  for (let i = 0; i < codes.length; i += 500) {
    const batch = codes.slice(i, i + 500);
    const { data, error } = await supabase
      .from('wines')
      .select(select)
      .in('item_code', batch);
    if (error || !data) continue;
    all.push(...(data as T[]));
  }
  return all;
}

// ═══ 기본 설정 ═══
const DEFAULT_STOCK_RULES = {
  price_300k: 6, price_200k: 12, price_100k: 60,
  price_50k: 120, price_20k: 180, price_under_20k: 300,
};

async function loadStockRules() {
  const { data } = await supabase
    .from('admin_settings').select('value').eq('key', 'recommend_stock_rules').maybeSingle();
  return data ? { ...DEFAULT_STOCK_RULES, ...JSON.parse(data.value) } : { ...DEFAULT_STOCK_RULES };
}

function minStockForPrice(price: number, SR: typeof DEFAULT_STOCK_RULES): number {
  if (price >= 300000) return SR.price_300k;
  if (price >= 200000) return SR.price_200k;
  if (price >= 100000) return SR.price_100k;
  if (price >= 50000) return SR.price_50k;
  if (price >= 20000) return SR.price_20k;
  return SR.price_under_20k;
}

// ═══ 유틸리티 ═══
function normalizeGrapes(raw: string): string[] {
  if (!raw) return [];
  return raw.toLowerCase().split(/[,\/]/).map(g => g.trim()).filter(Boolean);
}

function grapesOverlap(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  return a.some(ag => b.some(bg => ag.includes(bg) || bg.includes(ag)));
}

function priceInRange(target: number, candidate: number, pct: number): boolean {
  if (target <= 0 || candidate <= 0) return false;
  return Math.abs(candidate - target) / target <= pct;
}

// ═══ 와인 타입 정규화 (화이트/White → white, 레드/Red → red 등) ═══
function normalizeType(raw: string | null, name?: string): string {
  // 이름에 명시적 색상 키워드가 있으면 DB보다 우선 (데이터 오류 보정)
  if (name) {
    const n = name.toLowerCase();
    // "루즈"/"Rouge" 등 명시적 색상 단어 (한글은 \b 사용 불가하므로 공백/경계 체크)
    if (/(?:^|\s)루즈(?:\s|$|,)/.test(n) || /\brouge\b|\brosso\b/.test(n)) return 'red';
    if (/(?:^|\s)블랑(?:\s|$|,)/.test(n) || /\bblanc\b|\bbianco\b/.test(n)) return 'white';
    if (/(?:^|\s)로제(?:\s|$|,)/.test(n) || /\bros[eé]\b/.test(n)) return 'rosé';
  }
  if (raw) {
    const l = raw.toLowerCase().trim();
    if (l === '화이트' || l === 'white') return 'white';
    if (l === '레드' || l === 'red') return 'red';
    if (l === '로제' || l === 'rosé' || l === 'rose') return 'rosé';
    if (l === '스파클링' || l === 'sparkling') return 'sparkling';
    if (l === '주정강화' || l === 'fortified') return 'fortified';
    if (l) return l;
  }
  // 이름에서 타입 추론 (명시적 색상 없는 경우)
  if (name) {
    const n = name.toLowerCase();
    if (/champagne|prosecco|cava|cr[eé]mant|스파클링|sparkling/.test(n)) return 'sparkling';
    if (/chardonnay|sauvignon\s*blanc|riesling|chenin|viognier|pinot\s*grigio|pinot\s*gris|melon|muscat|gewurz|marsanne|roussanne/.test(n)) return 'white';
    // 지역명 기반 타입 추론
    if (/샤블리|chablis|뫼르소|meursault|퓔리니|puligny|꼬르통\s*샤를|corton.charlemagne|몽라셰|montrachet/.test(n)) return 'white';
    if (/cabernet|merlot|pinot\s*noir|syrah|shiraz|malbec|tempranillo|sangiovese|nebbiolo|grenache|mourvèdre|gamay|barbera|zinfandel/.test(n)) return 'red';
    if (/뮈지니|musigny|볼네|volnay|포마르|pommard|제브레|gevrey|에셰조|echezeaux|샹볼|chambolle|모레\s*생|morey|본\s*로마네|vosne|보졸레|beaujolais|뉘이\s*생|nuits.st/.test(n)) return 'red';
    if (/마고|margaux|뽀이약|pauillac|생\s*테밀리옹|st.emilion|생\s*줄리앙|st.julien|메독|medoc|샤또뇌프|chateauneuf/.test(n)) return 'red';
    if (/port|sherry|madeira|주정강화/.test(n)) return 'fortified';
  }
  return '';
}

// ═══ 슈퍼리전 매핑 (major_region → 보르도/부르고뉴 등 큰 그룹) ═══
const SUPER_REGION_MAP: Record<string, string> = {
  '메독 Médoc': 'Bordeaux',
  '그라브 Graves': 'Bordeaux',
  '우안 Right Bank': 'Bordeaux',
  '소테른 Sauternes': 'Bordeaux',
  '기타 보르도': 'Bordeaux',
  '샤블리 Chablis': 'Burgundy',
  '코트 드 뉘 Côte de Nuits': 'Burgundy',
  '코트 드 본 Côte de Beaune': 'Burgundy',
  '코트 샬로네즈 Côte Chalonnaise': 'Burgundy',
  '마코네 Mâconnais': 'Burgundy',
  '광역 Régionale': 'Burgundy',
  '북부 론 Northern Rhône': 'Rhône',
  '남부 론 Southern Rhône': 'Rhône',
  '상부 루아르 Upper Loire': 'Loire',
  '투렌 Touraine': 'Loire',
  '앙주소뮈르 Anjou-Saumur': 'Loire',
  '낭트 Nantais': 'Loire',
  '알자스 Alsace': 'Alsace',
  '샴페인 Champagne': 'Champagne',
  '랑그독 Languedoc': 'Languedoc-Roussillon',
  '루시용 Roussillon': 'Languedoc-Roussillon',
  '프로방스 Provence': 'Provence',
  '쥐라 Jura': 'Jura-Savoie',
  '사부아 Savoie': 'Jura-Savoie',
  '남서부 Sud-Ouest': 'Sud-Ouest',
  '코르시카 Corsica': 'Corsica',
};

// ═══ 등급 순위 (낮을수록 높은 등급) ═══
function classRank(cls: string | null): number {
  if (!cls) return 99;
  const c = cls.toLowerCase();
  if (c.includes('grand cru') && !c.includes('classé')) return 1;
  if (c.includes('1er') || c.includes('premier cru')) return 2;
  if (c.includes('2ème')) return 3;
  if (c.includes('3ème')) return 4;
  if (c.includes('4ème')) return 5;
  if (c.includes('5ème')) return 6;
  if (c.includes('classé')) return 7;
  if (c.includes('bourgeois')) return 8;
  if (c.includes('village')) return 10;
  if (c.includes('régionale') || c.includes('regionale')) return 15;
  return 12;
}

// ═══ 와인 이름/지역에서 등급 추출 ═══
function extractClassification(name: string, region: string): string {
  const text = `${name} ${region}`.toLowerCase();
  const hasGrandCru = /grand\s*cru/.test(text) || text.includes('그랑 크뤼');
  if (hasGrandCru && !/classé|classe/.test(text)) return 'Grand Cru';
  if (/1er\s*cru|premier\s*cru/.test(text) || text.includes('프리미에 크뤼')) return 'Premier Cru';
  return '';
}

// ═══ wine_regions 매칭: wines.region → 계층 위치 찾기 ═══
interface RegionHierarchy {
  sub_region: string;    // 뫼르소 Meursault
  major_region: string;  // 코트 드 본 Côte de Beaune
  super_region: string;  // Burgundy
  classification: string;
}

interface WineRegionRow {
  sub_region: string | null;
  major_region: string;
  appellation: string | null;
  cru_vineyard: string | null;
  classification: string | null;
}

function findHierarchy(
  wineRegion: string,
  wineName: string,
  regionRows: WineRegionRow[],
): RegionHierarchy | null {
  if (!wineRegion && !wineName) return null;

  const regionLower = (wineRegion || '').toLowerCase();
  const nameLower = (wineName || '').toLowerCase();

  // 1) region 필드에서 키워드 추출 (콤마로 분리, 첫 부분이 가장 구체적)
  const parts = regionLower.split(',').map(p => p.trim()).filter(Boolean);
  const specific = parts[0] || '';

  // 2) wine_regions의 sub_region 영문부분과 매칭
  let bestMatch: WineRegionRow | null = null;
  let bestScore = 0;

  for (const row of regionRows) {
    const subEn = extractEnglish(row.sub_region || '').toLowerCase();
    const appEn = extractEnglish(row.appellation || '').toLowerCase();
    const cruEn = (row.cru_vineyard || '').toLowerCase();

    let score = 0;

    // 크뤼/포도밭 이름이 와인명에 있으면 가장 높은 점수
    if (cruEn && (nameLower.includes(cruEn) || regionLower.includes(cruEn))) {
      score = 100;
    }
    // 아펠라시옹 매칭 (Meursault 등)
    else if (appEn && specific.includes(appEn.replace(' aoc', '').replace(' 1er cru', ''))) {
      score = 80;
    }
    // sub_region 매칭
    else if (subEn && (specific.includes(subEn) || subEn.includes(specific))) {
      score = 60;
    }
    // region 전체에서 sub_region 발견
    else if (subEn && regionLower.includes(subEn)) {
      score = 40;
    }
    // 이름에서 sub_region 발견
    else if (subEn && nameLower.includes(subEn)) {
      score = 30;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = row;
    }
  }

  if (!bestMatch || bestScore < 30) return null;

  const subRegion = bestMatch.sub_region || bestMatch.major_region;
  const majorRegion = bestMatch.major_region;
  const superRegion = SUPER_REGION_MAP[majorRegion] || '';

  // 등급: wine_regions에서 가져오거나 이름에서 추출
  let classification = bestMatch.classification || '';
  const extracted = extractClassification(wineName, wineRegion);
  if (extracted && (!classification || classRank(extracted) < classRank(classification))) {
    classification = extracted;
  }

  return { sub_region: subRegion, major_region: majorRegion, super_region: superRegion, classification };
}

function extractEnglish(bilingual: string): string {
  // "뫼르소 Meursault" → "Meursault"
  // "코트 드 본 Côte de Beaune" → "Côte de Beaune"
  const parts = bilingual.split(/\s+/);
  const enIdx = parts.findIndex(p => /^[A-ZÀ-ÿ]/.test(p));
  if (enIdx >= 0) return parts.slice(enIdx).join(' ');
  return bilingual;
}

// ═══ 메인 핸들러 ═══
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const itemNo = searchParams.get('item_no');
    if (!itemNo) {
      return NextResponse.json({ error: 'item_no 파라미터가 필요합니다.' }, { status: 400 });
    }

    // Phase 1: 대상 와인/재고 + 설정 + 산지 + 재고 있는 inventory 만 병렬 로드
    const [SR, targetWineRes, targetInvRes, inventory, regionRows] = await Promise.all([
      loadStockRules(),
      supabase.from('wines').select('item_code, item_name_kr, item_name_en, grape_varieties, wine_type, country_en, region, supply_price').eq('item_code', itemNo).maybeSingle(),
      supabase.from('inventory_cdv').select('item_no, item_name, country, supply_price').eq('item_no', itemNo).maybeSingle(),
      fetchInventoryInStock<Record<string, unknown>>('item_no, item_name, country, supply_price, available_stock, bonded_warehouse'),
      fetchAll('wine_regions', 'sub_region, major_region, appellation, cru_vineyard, classification'),
    ]);
    const targetWine = targetWineRes.data;
    const targetInv = targetInvRes.data;

    // Phase 2: 현재 재고 내 wines 만 .in() 으로 조회 (전체 wines fetchAll 대신)
    const inventoryItemCodes = inventory
      .map((i: Record<string, unknown>) => i.item_no as string | undefined)
      .filter(Boolean) as string[];
    // 대상 와인 자신은 targetWine 에서 이미 가지고 있으므로 제외 가능하나, 포함되어도 무해
    const wines = await fetchWinesByCodes<Record<string, unknown>>(
      inventoryItemCodes,
      'item_code, item_name_kr, item_name_en, grape_varieties, wine_type, country_en, region, supply_price',
    );

    const targetName = targetWine?.item_name_kr || targetInv?.item_name || itemNo;
    const targetFullName = `${targetWine?.item_name_kr || ''} ${targetWine?.item_name_en || ''}`;
    const targetGrapes = normalizeGrapes(targetWine?.grape_varieties || '');
    const targetType = normalizeType(targetWine?.wine_type || null, targetFullName || targetInv?.item_name || '');
    const targetCountry = (targetWine?.country_en || targetInv?.country || '').toLowerCase();
    const targetRegion = targetWine?.region || '';

    // 가격: supply_price가 0이면 같은 이름 와인의 가격을 참조
    let targetPrice = targetWine?.supply_price || targetInv?.supply_price || 0;
    if (targetPrice <= 0 && targetWine?.item_name_kr) {
      const nameBase = targetWine.item_name_kr.replace(/\s+/g, ' ').trim();
      const { data: sameName } = await supabase
        .from('wines')
        .select('supply_price')
        .ilike('item_name_kr', `%${nameBase}%`)
        .gt('supply_price', 0)
        .order('supply_price', { ascending: true })
        .limit(1);
      if (sameName?.[0]?.supply_price) targetPrice = sameName[0].supply_price;
    }

    // ── 타겟 와인의 산지 계층 위치 찾기 ──
    const allRegionRows = (regionRows || []) as WineRegionRow[];
    const targetHierarchy = findHierarchy(targetRegion, targetFullName, allRegionRows);

    // ── 후보 와인 맵 ──
    const wineMap = new Map<string, typeof wines extends (infer T)[] | null ? T : never>();
    for (const w of wines || []) wineMap.set(w.item_code, w);

    // ── 후보 빌드 (재고 충분 + 자기 자신 제외) ──
    interface Candidate {
      item_no: string;
      item_name: string;
      country: string;
      region: string;
      grape: string;
      wine_type: string;
      price: number;
      stock: number;
      hierarchy: RegionHierarchy | null;
    }

    const candidates: Candidate[] = [];
    for (const inv of inventory || []) {
      if (inv.item_no === itemNo) continue;
      const totalStock = (inv.available_stock || 0) + (inv.bonded_warehouse || 0);
      if (totalStock <= 0) continue;
      const price = inv.supply_price || 0;
      if (totalStock < minStockForPrice(price, SR)) continue;

      const wine = wineMap.get(inv.item_no);
      const fullName = `${wine?.item_name_kr || ''} ${wine?.item_name_en || ''}`;
      const wineType = normalizeType(wine?.wine_type || null, fullName || inv.item_name || '');

      // ★ 타입 필터: 타입이 확인된 경우에만 후보에 포함 (타입 불명은 제외)
      if (!wineType) continue;
      // ★ 타입 불일치 즉시 제외 (화이트↔레드 절대 안 됨)
      if (targetType && wineType !== targetType) continue;

      const wineRegion = wine?.region || '';
      const hierarchy = findHierarchy(wineRegion, fullName, allRegionRows);

      candidates.push({
        item_no: inv.item_no,
        item_name: wine?.item_name_kr || inv.item_name || '',
        country: (wine?.country_en || inv.country || '').toLowerCase(),
        region: wineRegion,
        grape: wine?.grape_varieties || '',
        wine_type: wineType,
        price,
        stock: totalStock,
        hierarchy,
      });
    }

    // ═══ 6단계 지역 확장 탐색 ═══
    interface Alternative {
      item_no: string;
      item_name: string;
      country: string;
      region: string;
      grape: string;
      wine_type: string;
      price: number;
      stock: number;
      match_level: number;
      match_label: string;
      match_reasons: string[];
    }

    const results: Alternative[] = [];
    const used = new Set<string>();
    const MAX = 3;

    function addResult(c: Candidate, level: number, label: string, reasons: string[]) {
      if (used.has(c.item_no)) return;
      used.add(c.item_no);
      results.push({ ...c, hierarchy: undefined as never, match_level: level, match_label: label, match_reasons: reasons });
    }

    const th = targetHierarchy; // 타겟 계층

    // ── Level 0: 같은 와인 다른 빈티지 (최우선) ──
    // 품번 패턴: 3022042 → prefix=30, vintage=22, suffix=042
    // 같은 prefix+suffix, 다른 vintage → 다음 빈티지
    {
      const vintageMatch = itemNo.match(/^(\d{2})(\d{2})(\d{3,})$/);
      if (vintageMatch) {
        const [, prefix, , suffix] = vintageMatch;
        for (const c of candidates) {
          if (used.has(c.item_no) || results.length >= MAX) continue;
          const cMatch = c.item_no.match(/^(\d{2})(\d{2})(\d{3,})$/);
          if (!cMatch) continue;
          if (cMatch[1] === prefix && cMatch[3] === suffix && cMatch[2] !== vintageMatch[2]) {
            addResult(c, 0, '다른 빈티지', [`같은 와인 ${cMatch[2]}빈티지`, `재고 ${c.stock}병`]);
          }
        }
      }
      // 이름 기반 빈티지 매칭 (품번 패턴 불일치 시)
      if (results.length === 0) {
        const targetBaseName = (targetWine?.item_name_kr || targetInv?.item_name || '')
          .replace(/["'「」]/g, '')
          .replace(/\d{2,4}\s*(빈티지|VT|vintage)?/gi, '')
          .replace(/\s+/g, ' ').trim().toLowerCase();
        if (targetBaseName.length > 5) {
          for (const c of candidates) {
            if (used.has(c.item_no) || results.length >= MAX) continue;
            const cBaseName = c.item_name
              .replace(/["'「」]/g, '')
              .replace(/\d{2,4}\s*(빈티지|VT|vintage)?/gi, '')
              .replace(/\s+/g, ' ').trim().toLowerCase();
            if (cBaseName === targetBaseName) {
              addResult(c, 0, '다른 빈티지', ['같은 와인 다른 빈티지', `재고 ${c.stock}병`]);
            }
          }
        }
      }
    }

    // ── Level 1: 같은 서브리전 + 같은 등급 + 가격 ±40% ──
    // 예: 뫼르소 Premier Cru 블라니 → 다른 뫼르소 Premier Cru (페리에르, 샤름 등)
    if (th?.sub_region) {
      for (const c of candidates) {
        if (used.has(c.item_no) || results.length >= MAX) continue;
        if (!c.hierarchy || c.hierarchy.sub_region !== th.sub_region) continue;
        // 등급이 같거나 비슷해야 함
        if (th.classification && c.hierarchy.classification) {
          if (Math.abs(classRank(c.hierarchy.classification) - classRank(th.classification)) > 2) continue;
        }
        if (!priceInRange(targetPrice, c.price, 0.4)) continue;

        const reasons = [`같은 산지 (${extractEnglish(th.sub_region)})`];
        if (c.hierarchy.classification) reasons.push(c.hierarchy.classification);
        if (grapesOverlap(targetGrapes, normalizeGrapes(c.grape))) reasons.push('같은 품종');
        reasons.push('비슷한 가격');
        addResult(c, 1, `${extractEnglish(th.sub_region)} · 동급`, reasons);
      }
    }

    // ── Level 2: 같은 서브리전 + 가격 ±40% (등급 무관) ──
    // 예: 뫼르소 Premier Cru → 뫼르소 Village
    if (th?.sub_region && results.length < MAX) {
      for (const c of candidates) {
        if (used.has(c.item_no) || results.length >= MAX) continue;
        if (!c.hierarchy || c.hierarchy.sub_region !== th.sub_region) continue;
        if (!priceInRange(targetPrice, c.price, 0.4)) continue;

        const reasons = [`같은 산지 (${extractEnglish(th.sub_region)})`];
        if (c.hierarchy.classification) reasons.push(c.hierarchy.classification);
        if (grapesOverlap(targetGrapes, normalizeGrapes(c.grape))) reasons.push('같은 품종');
        reasons.push('비슷한 가격');
        addResult(c, 2, `${extractEnglish(th.sub_region)}`, reasons);
      }
    }

    // ── Level 3: 같은 대지역 + 가격 ±30% ──
    // 예: 뫼르소 → 코트 드 본 (뽀마르, 볼네, 퓔리니 몽라셰 등)
    if (th?.major_region && results.length < MAX) {
      for (const c of candidates) {
        if (used.has(c.item_no) || results.length >= MAX) continue;
        if (!c.hierarchy || c.hierarchy.major_region !== th.major_region) continue;
        if (!priceInRange(targetPrice, c.price, 0.3)) continue;

        const reasons = [extractEnglish(th.major_region)];
        if (c.hierarchy.sub_region) reasons.push(extractEnglish(c.hierarchy.sub_region));
        if (grapesOverlap(targetGrapes, normalizeGrapes(c.grape))) reasons.push('같은 품종');
        reasons.push('비슷한 가격');
        addResult(c, 3, extractEnglish(th.major_region), reasons);
      }
    }

    // ── Level 4: 같은 슈퍼리전 + 가격 ±40% ──
    // 예: 코트 드 본 → 부르고뉴 전체 (코트 드 뉘, 샤블리, 마코네 등)
    if (th?.super_region && results.length < MAX) {
      for (const c of candidates) {
        if (used.has(c.item_no) || results.length >= MAX) continue;
        if (!c.hierarchy || c.hierarchy.super_region !== th.super_region) continue;
        if (!priceInRange(targetPrice, c.price, 0.4)) continue;

        const reasons = [th.super_region];
        if (c.hierarchy.major_region) reasons.push(extractEnglish(c.hierarchy.major_region));
        if (grapesOverlap(targetGrapes, normalizeGrapes(c.grape))) reasons.push('같은 품종');
        reasons.push('비슷한 가격');
        addResult(c, 4, th.super_region, reasons);
      }
    }

    // ── Level 5: 같은 국가 + 가격 ±50% ──
    // 예: 부르고뉴 → 프랑스 전체
    if (targetCountry && results.length < MAX) {
      for (const c of candidates) {
        if (used.has(c.item_no) || results.length >= MAX) continue;
        if (c.country !== targetCountry) continue;
        if (!priceInRange(targetPrice, c.price, 0.5)) continue;

        const reasons = ['같은 국가'];
        if (c.hierarchy?.super_region) reasons.push(c.hierarchy.super_region);
        if (grapesOverlap(targetGrapes, normalizeGrapes(c.grape))) reasons.push('같은 품종');
        reasons.push('유사 가격대');
        addResult(c, 5, '같은 국가', reasons);
      }
    }

    // ── Level 6: 같은 품종 + 가격 ±50% (글로벌) ──
    // 예: 프랑스 Chardonnay → 다른 나라 Chardonnay
    if (results.length < MAX) {
      for (const c of candidates) {
        if (used.has(c.item_no) || results.length >= MAX) continue;
        if (!grapesOverlap(targetGrapes, normalizeGrapes(c.grape))) continue;
        if (!priceInRange(targetPrice, c.price, 0.5)) continue;

        const reasons = ['같은 품종', '유사 가격대'];
        if (c.country) reasons.push(c.country);
        addResult(c, 6, '같은 품종', reasons);
      }
    }

    // 가격 가까운 순으로 2차 정렬
    results.sort((a, b) => {
      if (a.match_level !== b.match_level) return a.match_level - b.match_level;
      return Math.abs(a.price - targetPrice) - Math.abs(b.price - targetPrice);
    });

    const top10 = results.slice(0, MAX);

    return NextResponse.json({
      target: {
        item_no: itemNo,
        item_name: targetName,
        grape: targetWine?.grape_varieties || '',
        wine_type: targetType || targetWine?.wine_type || '',
        country: targetWine?.country_en || targetInv?.country || '',
        region: targetRegion,
        price: targetPrice,
        hierarchy: targetHierarchy,
      },
      alternatives: top10,
    });

  } catch (error) {
    console.error('Alternatives GET error:', error);
    return NextResponse.json(
      { error: '대체 와인 추천 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
