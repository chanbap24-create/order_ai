import { NextResponse } from 'next/server';
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

// ── 와인 이름에서 품종 추출 ──
const GRAPE_PATTERNS: { pattern: RegExp; grape: string }[] = [
  { pattern: /카베르네\s?소비뇽|cabernet\s?sauvignon/i, grape: 'Cabernet Sauvignon' },
  { pattern: /소비뇽\s?블랑|sauvignon\s?blanc/i, grape: 'Sauvignon Blanc' },
  { pattern: /피노\s?누아|피노누아|pinot\s?noir/i, grape: 'Pinot Noir' },
  { pattern: /샤르도네|chardonnay/i, grape: 'Chardonnay' },
  { pattern: /메를로|merlot/i, grape: 'Merlot' },
  { pattern: /시라|쉬라즈|syrah|shiraz/i, grape: 'Syrah' },
  { pattern: /리슬링|riesling/i, grape: 'Riesling' },
  { pattern: /말벡|malbec/i, grape: 'Malbec' },
  { pattern: /템프라니요|tempranillo/i, grape: 'Tempranillo' },
  { pattern: /산지오베제|sangiovese/i, grape: 'Sangiovese' },
  { pattern: /네비올로|nebbiolo/i, grape: 'Nebbiolo' },
  { pattern: /그르나슈|그르나쉬|grenache|garnacha/i, grape: 'Grenache' },
  { pattern: /무르베드르|mourvedre|mourvèdre/i, grape: 'Mourvedre' },
  { pattern: /진판델|zinfandel/i, grape: 'Zinfandel' },
  { pattern: /까베르네\s?프랑|cabernet\s?franc/i, grape: 'Cabernet Franc' },
  { pattern: /비오니에|viognier/i, grape: 'Viognier' },
  { pattern: /피노\s?그리|피노그리|pinot\s?gri[sg]/i, grape: 'Pinot Grigio' },
  { pattern: /겨르츠트라미너|게뷔르츠|gewurz|gewürz/i, grape: 'Gewurztraminer' },
  { pattern: /모스카토|moscato|뮈스까|muscat/i, grape: 'Moscato' },
  { pattern: /프리미티보|primitivo/i, grape: 'Primitivo' },
  { pattern: /가메|gamay/i, grape: 'Gamay' },
  { pattern: /알바리뇨|albariño|albarino/i, grape: 'Albarino' },
  { pattern: /트레비아노|trebbiano/i, grape: 'Trebbiano' },
  { pattern: /바르베라|barbera/i, grape: 'Barbera' },
  { pattern: /그뤼너\s?벨트리너|gruner\s?veltliner/i, grape: 'Gruner Veltliner' },
  { pattern: /세미용|semillon|sémillon/i, grape: 'Semillon' },
  { pattern: /쁘띠\s?베르도|petit\s?verdot/i, grape: 'Petit Verdot' },
  // 지역명 기반 품종 추정
  { pattern: /뮈지니|볼네[이]?|본\s?마르|포마르|제브레|에셰조|클로\s?드?\s?부조|끌로\s?드?\s?부조|샹볼|꼬또\s?부르기뇽|꼬또\s?드\s?뉘|모레\s?생|본\s?로마네|몽텔리|상트네/i, grape: 'Pinot Noir' },
  { pattern: /뫼르소|샤블리|퓔리니|꼬르통\s?샤를|몽라셰/i, grape: 'Chardonnay' },
  { pattern: /비온디\s?산티|BdM/i, grape: 'Sangiovese' },
  { pattern: /보졸레/i, grape: 'Gamay' },
];

// ── 와인 이름에서 타입 추출 ──
const TYPE_PATTERNS: { pattern: RegExp; type: string }[] = [
  { pattern: /스파클링|sparkling|크레망|cremant|crémant|프로세코|prosecco|까바|cava|제트|sekt/i, type: '스파클링' },
  { pattern: /샴페인|champagne|샹파뉴|찰스\s?하이직|브륏|brut/i, type: '스파클링' },
  { pattern: /로제|rosé|rose(?!\s*(마리|골드|와인))/i, type: '로제' },
  { pattern: /소비뇽\s?블랑|샤르도네|리슬링|비오니에|피노\s?그리|게뷔르츠|모스카토|뮈스까|알바리뇨|트레비아노|그뤼너|세미용/i, type: '화이트' },
  { pattern: /블랑|bianco|blanc|white|비앙코|화이트|브랑코|branco/i, type: '화이트' },
  { pattern: /카베르네|피노\s?누아|피노누아|메를로|시라|쉬라즈|말벡|템프라니요|산지오베제|네비올로|그르나슈|진판델|프리미티보|가메|바르베라/i, type: '레드' },
  { pattern: /루쥬|루즈|rosso|rouge|레드|tinto/i, type: '레드' },
  { pattern: /브루넬로|바롤로|바르바레스코|아마로네|키안티|리오하|BdM|비온디\s?산티/i, type: '레드' },
  { pattern: /뮈지니|볼네[이]?|본\s?마르|포마르|제브레|에셰조|클로\s?드?\s?부조|끌로\s?드?\s?부조|샹볼|꼬또\s?부르기뇽|꼬또\s?드\s?뉘|뉘이\s?생|모레\s?생|본\s?로마네|몽텔리|상트네|보졸레/i, type: '레드' },
  { pattern: /뫼르소|샤블리|퓔리니|꼬르통\s?샤를|몽라셰/i, type: '화이트' },
  { pattern: /마고|뽀이약|생\s?테밀리옹|뻬삭|메독|오\s?메독|생\s?줄리앙|생\s?에스텝/i, type: '레드' },
  { pattern: /꼬뜨\s?뒤\s?론|샤또뇌프\s?뒤\s?빠프|가르딘/i, type: '레드' },
  { pattern: /포트|쉐리|셰리|마데이라|port|sherry|madeira|마르살라/i, type: '주정강화' },
  { pattern: /그라파|grappa/i, type: '증류주' },
];

function extractGrapesFromName(name: string): string[] {
  if (!name) return [];
  const grapes: string[] = [];
  for (const { pattern, grape } of GRAPE_PATTERNS) {
    if (pattern.test(name)) grapes.push(grape);
  }
  return grapes;
}

function extractTypeFromName(name: string): string {
  if (!name) return '';
  for (const { pattern, type } of TYPE_PATTERNS) {
    if (pattern.test(name)) return type;
  }
  return '';
}

// ── 시즌 매핑 ──
function getSeasonInfo(month: number): { season: string; types: string[]; grapes: string[]; bodyPref: string[] } {
  if (month >= 3 && month <= 5) {
    return { season: '봄', types: ['로제', 'Rose', 'Rosé'], grapes: ['Sauvignon Blanc', '소비뇽 블랑', 'Riesling', '리슬링'], bodyPref: [] };
  }
  if (month >= 6 && month <= 8) {
    return { season: '여름', types: ['스파클링', 'Sparkling', '화이트', 'White', '로제', 'Rose', 'Rosé'], grapes: [], bodyPref: [] };
  }
  if (month >= 9 && month <= 11) {
    return { season: '가을', types: [], grapes: ['Pinot Noir', '피노 누아', '피노누아'], bodyPref: ['미디엄', 'medium'] };
  }
  return { season: '겨울', types: [], grapes: ['Syrah', '시라', 'Shiraz', '쉬라즈', 'Cabernet Sauvignon', '카베르네 소비뇽', '카베르네소비뇽'], bodyPref: ['풀바디', 'full'] };
}

// ═══ wine_regions 계층 매칭 유틸 ═══
const SUPER_REGION_MAP: Record<string, string> = {
  '메독 Médoc': 'Bordeaux', '그라브 Graves': 'Bordeaux', '우안 Right Bank': 'Bordeaux',
  '소테른 Sauternes': 'Bordeaux', '기타 보르도': 'Bordeaux',
  '샤블리 Chablis': 'Burgundy', '코트 드 뉘 Côte de Nuits': 'Burgundy',
  '코트 드 본 Côte de Beaune': 'Burgundy', '코트 샬로네즈 Côte Chalonnaise': 'Burgundy',
  '마코네 Mâconnais': 'Burgundy', '광역 Régionale': 'Burgundy',
  '북부 론 Northern Rhône': 'Rhône', '남부 론 Southern Rhône': 'Rhône',
  '상부 루아르 Upper Loire': 'Loire', '투렌 Touraine': 'Loire',
  '앙주소뮈르 Anjou-Saumur': 'Loire', '낭트 Nantais': 'Loire',
  '알자스 Alsace': 'Alsace', '샴페인 Champagne': 'Champagne',
  '랑그독 Languedoc': 'Languedoc-Roussillon', '루시용 Roussillon': 'Languedoc-Roussillon',
  '프로방스 Provence': 'Provence', '쥐라 Jura': 'Jura-Savoie', '사부아 Savoie': 'Jura-Savoie',
  '남서부 Sud-Ouest': 'Sud-Ouest', '코르시카 Corsica': 'Corsica',
};

function extractEnglish(bilingual: string): string {
  const parts = bilingual.split(/\s+/);
  const enIdx = parts.findIndex(p => /^[A-ZÀ-ÿ]/.test(p));
  if (enIdx >= 0) return parts.slice(enIdx).join(' ');
  return bilingual;
}

interface RegionHierarchy {
  sub_region: string;
  major_region: string;
  super_region: string;
  classification: string;
}

interface WineRegionRow {
  sub_region: string | null;
  major_region: string;
  appellation: string | null;
  cru_vineyard: string | null;
  classification: string | null;
}

function findHierarchy(wineRegion: string, wineName: string, regionRows: WineRegionRow[]): RegionHierarchy | null {
  if (!wineRegion && !wineName) return null;
  const regionLower = (wineRegion || '').toLowerCase();
  const nameLower = (wineName || '').toLowerCase();
  const parts = regionLower.split(',').map(p => p.trim()).filter(Boolean);
  const specific = parts[0] || '';

  let bestMatch: WineRegionRow | null = null;
  let bestScore = 0;

  for (const row of regionRows) {
    const subEn = extractEnglish(row.sub_region || '').toLowerCase();
    const appEn = extractEnglish(row.appellation || '').toLowerCase();
    const cruEn = (row.cru_vineyard || '').toLowerCase();
    let score = 0;

    if (cruEn && (nameLower.includes(cruEn) || regionLower.includes(cruEn))) score = 100;
    else if (appEn && specific.includes(appEn.replace(' aoc', '').replace(' 1er cru', ''))) score = 80;
    else if (subEn && (specific.includes(subEn) || subEn.includes(specific))) score = 60;
    else if (subEn && regionLower.includes(subEn)) score = 40;
    else if (subEn && nameLower.includes(subEn)) score = 30;

    if (score > bestScore) { bestScore = score; bestMatch = row; }
  }

  if (!bestMatch || bestScore < 30) return null;

  const subRegion = bestMatch.sub_region || bestMatch.major_region;
  const majorRegion = bestMatch.major_region;
  const superRegion = SUPER_REGION_MAP[majorRegion] || '';

  let classification = bestMatch.classification || '';
  const text = `${wineName} ${wineRegion}`.toLowerCase();
  const hasGrandCru = /grand\s*cru/.test(text) || text.includes('그랑 크뤼');
  if (hasGrandCru && !/classé|classe/.test(text)) classification = 'Grand Cru';
  else if (/1er\s*cru|premier\s*cru/.test(text) || text.includes('프리미에 크뤼')) classification = 'Premier Cru';

  return { sub_region: subRegion, major_region: majorRegion, super_region: superRegion, classification };
}

// ── 기본 가중치 (총 100점 만점) ──
const DEFAULT_W = {
  REORDER: 35,
  REGION_MATCH: 15,  // 산지 계층 매칭 (NEW)
  COUNTRY_MATCH: 5,  // 국가 매칭 (산지 매칭 불가 시 fallback)
  GRAPE_MATCH: 12,
  TYPE_MATCH: 8,
  PRICE_FIT: 10,
  SALES_VELOCITY: 5,
  SEASONAL: 7,
  UPSELL: 3,
};

const DEFAULT_STOCK_RULES = {
  price_300k: 6, price_200k: 12, price_100k: 60,
  price_50k: 120, price_20k: 180, price_under_20k: 300,
  months_supply: 3,
};

async function loadSettings() {
  const { data: wRow } = await supabase
    .from('admin_settings').select('value').eq('key', 'recommend_weights').maybeSingle();
  const { data: sRow } = await supabase
    .from('admin_settings').select('value').eq('key', 'recommend_stock_rules').maybeSingle();
  const W = wRow ? { ...DEFAULT_W, ...JSON.parse(wRow.value) } : { ...DEFAULT_W };
  const SR = sRow ? { ...DEFAULT_STOCK_RULES, ...JSON.parse(sRow.value) } : { ...DEFAULT_STOCK_RULES };
  return { W, SR };
}

interface ScoredItem {
  item_no: string;
  item_name: string;
  country: string;
  region: string;
  grape: string;
  wine_type: string;
  price: number;
  stock: number;
  score: number;
  tags: string[];
  reason: string;
  buy_count?: number;
  last_order?: string;
}

export async function POST(req: Request) {
  try {
    const { client_code } = await req.json();
    if (!client_code) {
      return NextResponse.json({ error: 'client_code가 필요합니다.' }, { status: 400 });
    }

    // ── 병렬 데이터 로드 ──
    const [{ W, SR }, { data: clientDetail }, { data: clientBasic }, { data: shipments }, rawInventory, wines, regionRows] = await Promise.all([
      loadSettings(),
      supabase.from('client_details').select('*').eq('client_code', client_code).maybeSingle(),
      supabase.from('clients').select('*').eq('client_code', client_code).maybeSingle(),
      supabase.from('shipments').select('item_no, item_name, unit_price, ship_date').eq('client_code', client_code),
      fetchAll('inventory_cdv', 'item_no, item_name, country, supply_price, available_stock, bonded_warehouse, sales_30days, avg_sales_90d, avg_sales_365d'),
      fetchAll('wines', 'item_code, country, country_en, grape_varieties, wine_type, region, item_name_kr, item_name_en'),
      fetchAll('wine_regions', 'sub_region, major_region, appellation, cru_vineyard, classification'),
    ]);

    const allRegionRows = (regionRows || []) as WineRegionRow[];
    const clientName = clientDetail?.client_name || clientBasic?.client_name || client_code;

    // ── shipments에서 직접 구매 이력 집계 ──
    const purchaseAgg: Record<string, { count: number; lastDate: string; totalPrice: number; name: string }> = {};
    for (const s of shipments || []) {
      if (!s.item_no) continue;
      if (!purchaseAgg[s.item_no]) {
        purchaseAgg[s.item_no] = { count: 0, lastDate: '', totalPrice: 0, name: s.item_name || '' };
      }
      const agg = purchaseAgg[s.item_no];
      agg.count++;
      if (s.ship_date && s.ship_date > agg.lastDate) agg.lastDate = s.ship_date;
      if (s.unit_price) agg.totalPrice += s.unit_price;
    }

    const purchasedItemNos = new Set(Object.keys(purchaseAgg));

    // ── 재고 필터 ──
    const minStockForPrice = (price: number): number => {
      if (price >= 300000) return SR.price_300k;
      if (price >= 200000) return SR.price_200k;
      if (price >= 100000) return SR.price_100k;
      if (price >= 50000) return SR.price_50k;
      if (price >= 20000) return SR.price_20k;
      return SR.price_under_20k;
    }

    const inventory = (rawInventory || []).filter(inv => {
      const price = inv.supply_price || 0;
      const stock = (inv.available_stock || 0) + (inv.bonded_warehouse || 0);
      if (stock <= 0) return false;
      const sales90d = inv.avg_sales_90d || 0;
      if (stock < minStockForPrice(price)) return false;
      if (sales90d > 0) {
        const demandDays = sales90d * (SR.months_supply * 30);
        if (stock < demandDays) return false;
      }
      inv._totalStock = stock;
      return true;
    });

    const inventoryMap = new Map<string, any>();
    for (const inv of inventory) inventoryMap.set(inv.item_no, inv);

    // ── wines 테이블 메타데이터 ──
    const wineMap = new Map<string, any>();
    for (const w of wines || []) {
      if (!w.grape_varieties) {
        const extracted = extractGrapesFromName(w.item_name_kr || '');
        if (extracted.length > 0) w.grape_varieties = extracted.join(', ');
      }
      if (!w.wine_type) {
        w.wine_type = extractTypeFromName(w.item_name_kr || '');
      }
      // 산지 계층 매칭
      const fullName = `${w.item_name_kr || ''} ${w.item_name_en || ''}`;
      w._hierarchy = findHierarchy(w.region || '', fullName, allRegionRows);
      wineMap.set(w.item_code, w);
    }

    // ═══ 거래처 선호도 분석 ═══
    const countryBuyCount: Record<string, number> = {};
    const grapeBuyCount: Record<string, number> = {};
    const typeBuyCount: Record<string, number> = {};
    // ★ 산지 선호도
    const subRegionBuyCount: Record<string, number> = {};
    const majorRegionBuyCount: Record<string, number> = {};
    const superRegionBuyCount: Record<string, number> = {};

    let totalPurchases = 0;
    const priceList: number[] = [];

    for (const [itemNo, agg] of Object.entries(purchaseAgg)) {
      totalPurchases += agg.count;
      const avgPrice = agg.totalPrice / agg.count;
      if (avgPrice > 0) priceList.push(avgPrice);

      const wine = wineMap.get(itemNo);
      const inv = inventoryMap.get(itemNo);
      const country = wine?.country || wine?.country_en || inv?.country || '';
      if (country) countryBuyCount[country] = (countryBuyCount[country] || 0) + agg.count;

      // ★ 산지 선호도 집계
      const h: RegionHierarchy | null = wine?._hierarchy || null;
      if (h) {
        if (h.sub_region) subRegionBuyCount[h.sub_region] = (subRegionBuyCount[h.sub_region] || 0) + agg.count;
        if (h.major_region) majorRegionBuyCount[h.major_region] = (majorRegionBuyCount[h.major_region] || 0) + agg.count;
        if (h.super_region) superRegionBuyCount[h.super_region] = (superRegionBuyCount[h.super_region] || 0) + agg.count;
      }

      // 품종
      let grapeStr = wine?.grape_varieties || '';
      if (!grapeStr && (inv?.item_name || agg.name)) {
        const extracted = extractGrapesFromName(inv?.item_name || agg.name);
        if (extracted.length > 0) grapeStr = extracted.join(', ');
      }
      if (grapeStr) {
        const grapes = grapeStr.split(/[,\/]/).map((g: string) => g.trim()).filter(Boolean);
        for (const g of grapes) grapeBuyCount[g] = (grapeBuyCount[g] || 0) + agg.count;
      }

      // 와인 타입
      let wt = wine?.wine_type || '';
      if (!wt && (inv?.item_name || agg.name)) {
        wt = extractTypeFromName(inv?.item_name || agg.name);
      }
      if (wt) {
        wt = wt.trim();
        if (wt) typeBuyCount[wt] = (typeBuyCount[wt] || 0) + agg.count;
      }
    }

    const clientAvgPrice = priceList.length > 0
      ? priceList.reduce((a, b) => a + b, 0) / priceList.length : 0;

    const topCountries = Object.entries(countryBuyCount).sort((a, b) => b[1] - a[1]);
    const topGrapes = Object.entries(grapeBuyCount).sort((a, b) => b[1] - a[1]);
    const topTypes = Object.entries(typeBuyCount).sort((a, b) => b[1] - a[1]);
    const maxCountryBuy = topCountries[0]?.[1] || 1;
    const maxGrapeBuy = topGrapes[0]?.[1] || 1;
    const maxTypeBuy = topTypes[0]?.[1] || 1;

    // ★ 산지 선호도 최대값
    const maxSubRegionBuy = Math.max(...Object.values(subRegionBuyCount), 1);
    const maxMajorRegionBuy = Math.max(...Object.values(majorRegionBuyCount), 1);
    const maxSuperRegionBuy = Math.max(...Object.values(superRegionBuyCount), 1);
    const hasRegionPrefs = Object.keys(subRegionBuyCount).length > 0;

    // 시즌
    const currentMonth = new Date().getMonth() + 1;
    const seasonInfo = getSeasonInfo(currentMonth);

    // 판매속도 최대값
    let maxSales90d = 1;
    for (const inv of inventory || []) {
      if ((inv.avg_sales_90d || 0) > maxSales90d) maxSales90d = inv.avg_sales_90d;
    }

    // 3개월 전
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsAgoStr = threeMonthsAgo.toISOString().slice(0, 10);

    const hasHistory = totalPurchases > 0;

    // ═══ 통합 스코어링 ═══
    const scored: ScoredItem[] = [];

    for (const inv of inventory || []) {
      const itemNo = inv.item_no;
      const wine = wineMap.get(itemNo);
      const invCountry = wine?.country || wine?.country_en || inv.country || '';
      let invGrapes = wine?.grape_varieties || '';
      if (!invGrapes && inv.item_name) {
        const extracted = extractGrapesFromName(inv.item_name);
        if (extracted.length > 0) invGrapes = extracted.join(', ');
      }
      let wineType = wine?.wine_type || '';
      if (!wineType && inv.item_name) {
        wineType = extractTypeFromName(inv.item_name);
      }
      const invPrice = inv.supply_price || 0;
      const candidateH: RegionHierarchy | null = wine?._hierarchy || null;

      let score = 0;
      const tags: string[] = [];
      const reasons: string[] = [];

      const purchase = purchaseAgg[itemNo];

      // ── A. 재주문 (이미 구매한 와인) ──
      if (purchase) {
        const isStale = !purchase.lastDate || purchase.lastDate <= threeMonthsAgoStr;
        if (purchase.count >= 2 && isStale) {
          const buyRatio = Math.min(purchase.count / Math.max(totalPurchases * 0.05, 3), 1);
          score += W.REORDER * buyRatio;
          tags.push('재주문');
          reasons.push(`${purchase.count}회 구매, ${purchase.lastDate || '날짜미상'} 이후 미발주`);
        }
        if (!tags.includes('재주문')) continue;
      }

      // ── 미구매 와인 점수 ──
      if (!purchase) {
        // ★ B. 산지 계층 매칭 (REGION_MATCH) ──
        let regionMatched = false;
        if (candidateH && hasRegionPrefs && W.REGION_MATCH > 0) {
          // 같은 서브리전 (뫼르소 → 뫼르소)
          if (candidateH.sub_region && subRegionBuyCount[candidateH.sub_region]) {
            const ratio = subRegionBuyCount[candidateH.sub_region] / maxSubRegionBuy;
            score += W.REGION_MATCH * ratio;
            tags.push('선호산지');
            reasons.push(extractEnglish(candidateH.sub_region));
            regionMatched = true;
          }
          // 같은 대지역 (뫼르소 → 코트 드 본)
          else if (candidateH.major_region && majorRegionBuyCount[candidateH.major_region]) {
            const ratio = majorRegionBuyCount[candidateH.major_region] / maxMajorRegionBuy;
            score += W.REGION_MATCH * ratio * 0.6;
            tags.push('인근산지');
            reasons.push(extractEnglish(candidateH.major_region));
            regionMatched = true;
          }
          // 같은 슈퍼리전 (코트 드 본 → 부르고뉴)
          else if (candidateH.super_region && superRegionBuyCount[candidateH.super_region]) {
            const ratio = superRegionBuyCount[candidateH.super_region] / maxSuperRegionBuy;
            score += W.REGION_MATCH * ratio * 0.3;
            tags.push('같은지역');
            reasons.push(candidateH.super_region);
            regionMatched = true;
          }
        }

        // C. 국가 매치 (산지 매칭이 안 된 경우 fallback)
        if (!regionMatched && invCountry && countryBuyCount[invCountry]) {
          const ratio = countryBuyCount[invCountry] / maxCountryBuy;
          score += W.COUNTRY_MATCH * ratio;
          tags.push('선호국가');
          reasons.push(invCountry);
        }

        // D. 품종 매치
        if (invGrapes && topGrapes.length > 0) {
          let bestRatio = 0;
          let matchedGrape = '';
          for (const [grape, cnt] of topGrapes) {
            if (invGrapes.toLowerCase().includes(grape.toLowerCase())) {
              const ratio = cnt / maxGrapeBuy;
              if (ratio > bestRatio) { bestRatio = ratio; matchedGrape = grape; }
            }
          }
          if (bestRatio > 0) {
            score += W.GRAPE_MATCH * bestRatio;
            tags.push('선호품종');
            reasons.push(matchedGrape);
          }
        }

        // E. 와인 타입 매치
        if (wineType && topTypes.length > 0) {
          let bestTypeRatio = 0;
          let matchedType = '';
          for (const [type, cnt] of topTypes) {
            if (wineType.toLowerCase().includes(type.toLowerCase()) ||
                type.toLowerCase().includes(wineType.toLowerCase())) {
              const ratio = cnt / maxTypeBuy;
              if (ratio > bestTypeRatio) { bestTypeRatio = ratio; matchedType = type; }
            }
          }
          if (bestTypeRatio > 0) {
            score += W.TYPE_MATCH * bestTypeRatio;
            tags.push('선호타입');
            reasons.push(matchedType);
          }
        }

        // F-1. 가격 적합도
        if (clientAvgPrice > 0 && invPrice > 0) {
          const priceDiff = Math.abs(invPrice - clientAvgPrice) / clientAvgPrice;
          if (priceDiff <= 0.2) {
            score += W.PRICE_FIT * (1 - priceDiff / 0.2);
            tags.push('적정가격');
          } else if (invPrice > clientAvgPrice && priceDiff <= 0.5) {
            const fit = 1 - ((priceDiff - 0.2) / 0.3);
            score += W.UPSELL * fit;
            tags.push('프리미엄');
            reasons.push(`평균가 +${Math.round(priceDiff * 100)}%`);
          }
        }

        // F-2. 시즌 매치
        let seasonMatched = false;
        for (const t of seasonInfo.types) {
          if (wineType.toLowerCase().includes(t.toLowerCase())) { seasonMatched = true; break; }
        }
        if (!seasonMatched) {
          for (const g of seasonInfo.grapes) {
            if (invGrapes.toLowerCase().includes(g.toLowerCase())) { seasonMatched = true; break; }
          }
        }
        if (seasonMatched) {
          score += W.SEASONAL;
          tags.push(seasonInfo.season);
          reasons.push(`${seasonInfo.season} 시즌`);
        }

        // F-3. 판매속도 (인기도)
        const sales90d = inv.avg_sales_90d || 0;
        if (sales90d > 0) {
          const velocityScore = W.SALES_VELOCITY * (sales90d / maxSales90d);
          score += velocityScore;
          if (sales90d >= maxSales90d * 0.3) {
            tags.push('인기');
          }
        }

        // 이력 있는 거래처: 최소 1개 선호 매치 필요
        if (hasHistory && !tags.some(t => ['선호산지', '인근산지', '같은지역', '선호국가', '선호품종', '선호타입', '적정가격'].includes(t))) continue;
        if (!hasHistory && tags.length === 0) continue;
      }

      // 가용재고 0이고 보세에만 있으면 '통관필요' 태그
      if ((inv.available_stock || 0) <= 0 && (inv.bonded_warehouse || 0) > 0) {
        tags.push('통관필요');
      }

      scored.push({
        item_no: itemNo,
        item_name: inv.item_name,
        country: invCountry,
        region: wine?.region || '',
        grape: invGrapes,
        wine_type: wineType,
        price: invPrice,
        stock: inv._totalStock ?? ((inv.available_stock || 0) + (inv.bonded_warehouse || 0)),
        score: Math.round(score * 10) / 10,
        tags,
        reason: reasons.join(' · ') || '추천 와인',
        buy_count: purchase?.count,
        last_order: purchase?.lastDate,
      });
    }

    scored.sort((a, b) => b.score - a.score);
    const recommendations = scored.slice(0, 30);

    // ── 마지막 주문일 ──
    let lastOrderDate: string | null = null;
    for (const agg of Object.values(purchaseAgg)) {
      if (agg.lastDate && (!lastOrderDate || agg.lastDate > lastOrderDate)) {
        lastOrderDate = agg.lastDate;
      }
    }

    // ── 이력 저장 ──
    if (recommendations.length > 0) {
      await supabase.from('recommendations').insert({
        client_code,
        item_codes: recommendations.map(i => i.item_no),
        reason: `AI 추천 ${recommendations.length}개 (산지+점수 기반)`,
        recommendation_type: 'ai_score',
        status: 'pending',
      });
    }

    return NextResponse.json({
      client: {
        code: client_code,
        name: clientName,
        importance: clientDetail?.importance || 3,
        business_type: clientDetail?.business_type || '',
        manager: clientDetail?.manager || '',
      },
      recommendations,
      summary: {
        total_items: Object.keys(purchaseAgg).length,
        avg_price: Math.round(clientAvgPrice),
        last_order_date: lastOrderDate,
        top_countries: topCountries.slice(0, 3).map(e => e[0]),
        top_grapes: topGrapes.slice(0, 3).map(e => e[0]),
        top_types: topTypes.slice(0, 3).map(e => e[0]),
        top_regions: Object.entries(subRegionBuyCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([r]) => extractEnglish(r)),
      },
    });

  } catch (error) {
    console.error('Recommend API error:', error);
    return NextResponse.json(
      { error: '추천 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
