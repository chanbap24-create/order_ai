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
  { pattern: /진판델|zinfandel/i, grape: 'Zinfandel' },
  { pattern: /까베르네\s?프랑|cabernet\s?franc/i, grape: 'Cabernet Franc' },
  { pattern: /비오니에|viognier/i, grape: 'Viognier' },
  { pattern: /피노\s?그리|피노그리|pinot\s?gri[sg]/i, grape: 'Pinot Grigio' },
  { pattern: /모스카토|moscato|뮈스까|muscat/i, grape: 'Moscato' },
  { pattern: /프리미티보|primitivo/i, grape: 'Primitivo' },
  { pattern: /가메|gamay/i, grape: 'Gamay' },
  { pattern: /바르베라|barbera/i, grape: 'Barbera' },
  // 지역명 기반 품종 추정
  { pattern: /뮈지니|볼네[이]?|본\s?마르|포마르|제브레|에셰조|클로\s?드?\s?부조|끌로\s?드?\s?부조|샹볼|꼬또\s?부르기뇽|꼬또\s?드\s?뉘|모레\s?생|본\s?로마네|몽텔리|상트네/i, grape: 'Pinot Noir' },
  { pattern: /뫼르소|샤블리|퓔리니|꼬르통\s?샤를|몽라셰/i, grape: 'Chardonnay' },
  { pattern: /비온디\s?산티|BdM/i, grape: 'Sangiovese' },
  { pattern: /보졸레/i, grape: 'Gamay' },
];

const TYPE_PATTERNS: { pattern: RegExp; type: string }[] = [
  { pattern: /스파클링|sparkling|크레망|cremant|프로세코|prosecco|까바|cava/i, type: '스파클링' },
  { pattern: /샴페인|champagne|샹파뉴|찰스\s?하이직|브륏|brut/i, type: '스파클링' },
  { pattern: /로제|rosé|rose(?!\s*(마리|골드|와인))/i, type: '로제' },
  { pattern: /소비뇽\s?블랑|샤르도네|리슬링|비오니에|피노\s?그리|모스카토|뮈스까|알바리뇨/i, type: '화이트' },
  { pattern: /블랑|bianco|blanc|white|비앙코|화이트|브랑코|branco/i, type: '화이트' },
  { pattern: /카베르네|피노\s?누아|피노누아|메를로|시라|쉬라즈|말벡|템프라니요|산지오베제|네비올로|그르나슈|진판델|프리미티보|가메|바르베라/i, type: '레드' },
  { pattern: /루쥬|루즈|rosso|rouge|레드|tinto/i, type: '레드' },
  { pattern: /브루넬로|바롤로|바르바레스코|아마로네|키안티|리오하|BdM|비온디\s?산티/i, type: '레드' },
  { pattern: /뮈지니|볼네[이]?|본\s?마르|포마르|제브레|에셰조|클로\s?드?\s?부조|끌로\s?드?\s?부조|샹볼|꼬또\s?부르기뇽|꼬또\s?드\s?뉘|뉘이\s?생|모레\s?생|본\s?로마네|몽텔리|상트네|보졸레/i, type: '레드' },
  { pattern: /뫼르소|샤블리|퓔리니|꼬르통\s?샤를|몽라셰/i, type: '화이트' },
  { pattern: /마고|뽀이약|생\s?테밀리옹|뻬삭|메독|오\s?메독|생\s?줄리앙|생\s?에스텝/i, type: '레드' },
  { pattern: /꼬뜨\s?뒤\s?론|샤또뇌프\s?뒤\s?빠프|가르딘/i, type: '레드' },
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

// ── 시즌 매핑 (recommend API와 동일) ──
function getSeasonInfo(month: number): { season: string; types: string[]; grapes: string[] } {
  if (month >= 3 && month <= 5) return { season: '봄', types: ['로제', 'Rose', 'Rosé'], grapes: ['Sauvignon Blanc', 'Riesling'] };
  if (month >= 6 && month <= 8) return { season: '여름', types: ['스파클링', 'Sparkling', '화이트', 'White', '로제'], grapes: [] };
  if (month >= 9 && month <= 11) return { season: '가을', types: [], grapes: ['Pinot Noir'] };
  return { season: '겨울', types: [], grapes: ['Syrah', 'Cabernet Sauvignon'] };
}

const DEFAULT_W = {
  REORDER: 35, COUNTRY_MATCH: 5, GRAPE_MATCH: 12, TYPE_MATCH: 8,
  PRICE_FIT: 10, SALES_VELOCITY: 5, SEASONAL: 7, UPSELL: 3,
};

const DEFAULT_STOCK_RULES = {
  price_300k: 6, price_200k: 12, price_100k: 60,
  price_50k: 120, price_20k: 180, price_under_20k: 300, months_supply: 3,
};

async function loadSettings() {
  // 두 설정 row 병렬 조회
  const [wRes, sRes] = await Promise.all([
    supabase.from('admin_settings').select('value').eq('key', 'recommend_weights').maybeSingle(),
    supabase.from('admin_settings').select('value').eq('key', 'recommend_stock_rules').maybeSingle(),
  ]);
  const W = wRes.data ? { ...DEFAULT_W, ...JSON.parse(wRes.data.value) } : { ...DEFAULT_W };
  const SR = sRes.data ? { ...DEFAULT_STOCK_RULES, ...JSON.parse(sRes.data.value) } : { ...DEFAULT_STOCK_RULES };
  return { W, SR };
}

// POST: AI 브리핑 생성
export async function POST(req: NextRequest) {
  try {
    const { meeting_id, client_code: rawClientCode } = await req.json();

    let clientCode = rawClientCode;
    let meetingId = meeting_id;

    // meeting_id가 있으면 거기서 client_code 가져오기
    if (meetingId && !clientCode) {
      const { data: meeting } = await supabase
        .from('meetings')
        .select('client_code')
        .eq('id', meetingId)
        .single();
      if (!meeting) return NextResponse.json({ error: '미팅을 찾을 수 없습니다.' }, { status: 404 });
      clientCode = meeting.client_code;
    }

    if (!clientCode) {
      return NextResponse.json({ error: 'client_code 또는 meeting_id가 필요합니다.' }, { status: 400 });
    }

    // ── 1. 거래처 매출 요약 (병렬 조회) ──
    const [clientDetailRes, clientBasicRes, shipmentsRes] = await Promise.all([
      supabase.from('client_details').select('*').eq('client_code', clientCode).maybeSingle(),
      supabase.from('clients').select('*').eq('client_code', clientCode).maybeSingle(),
      supabase
        .from('shipments')
        .select('item_no, item_name, unit_price, ship_date, quantity, total_amount')
        .eq('client_code', clientCode)
        .order('ship_date', { ascending: false }),
    ]);
    const clientDetail = clientDetailRes.data;
    const clientBasic = clientBasicRes.data;
    const shipments = shipmentsRes.data || [];
    const clientName = clientDetail?.client_name || clientBasic?.client_name || clientCode;

    // 매출 통계
    let totalPurchases = 0;
    const priceList: number[] = [];
    const countryCount: Record<string, number> = {};
    const grapeCount: Record<string, number> = {};
    const typeCount: Record<string, number> = {};
    let lastOrderDate: string | null = null;
    const purchaseAgg: Record<string, { count: number; lastDate: string; totalPrice: number; name: string }> = {};

    // wines 메타데이터 — 구매 이력에 있는 item_code 만 조회 (전체 fetch 대신 .in() 배치)
    const purchasedCodes = Array.from(
      new Set(shipments.map(s => s.item_no).filter(Boolean) as string[]),
    );
    const wineMap = new Map<string, any>();
    if (purchasedCodes.length > 0) {
      for (let i = 0; i < purchasedCodes.length; i += 500) {
        const batch = purchasedCodes.slice(i, i + 500);
        const { data: batchWines } = await supabase
          .from('wines')
          .select('item_code, country, country_en, grape_varieties, wine_type, region, item_name_kr')
          .in('item_code', batch);
        for (const w of batchWines || []) {
          if (!w.grape_varieties) {
            const extracted = extractGrapesFromName(w.item_name_kr || '');
            if (extracted.length > 0) w.grape_varieties = extracted.join(', ');
          }
          if (!w.wine_type) {
            w.wine_type = extractTypeFromName(w.item_name_kr || '');
          }
          wineMap.set(w.item_code, w);
        }
      }
    }

    const now = new Date();
    const currentYear = now.getFullYear().toString();
    let yearlyRevenue = 0;

    for (const s of shipments) {
      if (!s.item_no) continue;
      totalPurchases++;
      if (s.unit_price) priceList.push(s.unit_price);
      if (s.ship_date && (!lastOrderDate || s.ship_date > lastOrderDate)) lastOrderDate = s.ship_date;

      // 올해 매출 합산
      if (s.ship_date?.toString().startsWith(currentYear)) {
        yearlyRevenue += (s.total_amount || 0);
      }

      if (!purchaseAgg[s.item_no]) {
        purchaseAgg[s.item_no] = { count: 0, lastDate: '', totalPrice: 0, name: s.item_name || '' };
      }
      const agg = purchaseAgg[s.item_no];
      agg.count++;
      if (s.ship_date && s.ship_date > agg.lastDate) agg.lastDate = s.ship_date;
      if (s.unit_price) agg.totalPrice += s.unit_price;

      const wine = wineMap.get(s.item_no);
      const itemCountry = wine?.country || wine?.country_en || '';
      if (itemCountry) countryCount[itemCountry] = (countryCount[itemCountry] || 0) + 1;

      // 품종: wines → 이름 추출 fallback
      let grapeStr = wine?.grape_varieties || '';
      if (!grapeStr && s.item_name) {
        const extracted = extractGrapesFromName(s.item_name);
        if (extracted.length > 0) grapeStr = extracted.join(', ');
      }
      if (grapeStr) {
        for (const g of grapeStr.split(/[,\/]/).map((x: string) => x.trim()).filter(Boolean)) {
          grapeCount[g] = (grapeCount[g] || 0) + 1;
        }
      }

      // 와인타입: wines → 이름 추출 fallback
      let itemType = wine?.wine_type || '';
      if (!itemType && s.item_name) itemType = extractTypeFromName(s.item_name);
      if (itemType) typeCount[itemType] = (typeCount[itemType] || 0) + 1;
    }

    const avgPrice = priceList.length > 0 ? Math.round(priceList.reduce((a, b) => a + b, 0) / priceList.length) : 0;
    const topCountries = Object.entries(countryCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
    const topGrapes = Object.entries(grapeCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
    const topTypes = Object.entries(typeCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);

    // 최근 3개월 vs 이전 3개월 트렌드
    const threeMonthsAgo = new Date(now); threeMonthsAgo.setMonth(now.getMonth() - 3);
    const sixMonthsAgo = new Date(now); sixMonthsAgo.setMonth(now.getMonth() - 6);
    const threeStr = threeMonthsAgo.toISOString().slice(0, 10);
    const sixStr = sixMonthsAgo.toISOString().slice(0, 10);

    let recentQtr = 0, prevQtr = 0;
    for (const s of shipments) {
      const d = s.ship_date?.toString().slice(0, 10) || '';
      const amt = s.total_amount || s.unit_price || 0;
      if (d >= threeStr) recentQtr += amt;
      else if (d >= sixStr) prevQtr += amt;
    }
    const trend = prevQtr > 0 ? (recentQtr > prevQtr ? 'up' : recentQtr < prevQtr ? 'down' : 'stable') : (recentQtr > 0 ? 'up' : 'stable');

    const clientSummary = {
      total_purchases: totalPurchases,
      avg_price: avgPrice,
      top_countries: topCountries,
      top_grapes: topGrapes,
      top_types: topTypes,
      last_order_date: lastOrderDate,
      trend,
      yearly_revenue: yearlyRevenue,
      importance: clientDetail?.importance || null,
    };

    // ── 2. 추천 와인 Top 10 (recommend 로직 간소화) ──
    // settings + inventory(재고 있는 것만) 병렬
    const [settings, invRes] = await Promise.all([
      loadSettings(),
      supabase
        .from('inventory_cdv')
        .select('item_no, item_name, country, supply_price, available_stock, bonded_warehouse, avg_sales_90d, brand')
        .or('available_stock.gt.0,bonded_warehouse.gt.0'),
    ]);
    const { W, SR } = settings;
    const rawInventory = invRes.data;

    function minStockForPrice(price: number): number {
      if (price >= 300000) return SR.price_300k;
      if (price >= 200000) return SR.price_200k;
      if (price >= 100000) return SR.price_100k;
      if (price >= 50000) return SR.price_50k;
      if (price >= 20000) return SR.price_20k;
      return SR.price_under_20k;
    }

    const inventory = (rawInventory || []).filter(inv => {
      const stock = (inv.available_stock || 0) + (inv.bonded_warehouse || 0);
      if (stock <= 0) return false;
      if (stock < minStockForPrice(inv.supply_price || 0)) return false;
      const sales90d = inv.avg_sales_90d || 0;
      if (sales90d > 0 && stock < sales90d * (SR.months_supply * 30)) return false;
      inv._totalStock = stock;
      return true;
    });

    // ── 할인률 & 구매 품목 등급 ──
    const invPriceMap: Record<string, { supply: number; retail: number }> = {};
    for (const inv of rawInventory || []) {
      invPriceMap[inv.item_no] = { supply: inv.supply_price || 0, retail: 0 };
    }

    let discountSum = 0, discountCount = 0;
    for (const s of shipments) {
      if (s.unit_price && s.item_no && invPriceMap[s.item_no]?.supply) {
        const sp = invPriceMap[s.item_no].supply;
        const disc = ((sp - s.unit_price) / sp) * 100;
        if (disc > 0 && disc <= 100) { discountSum += disc; discountCount++; }
      }
    }
    const avgDiscountRate = discountCount > 0 ? Math.round(discountSum / discountCount * 10) / 10 : null;

    const purchasedItems = Object.entries(purchaseAgg)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .map(([itemNo, agg]) => {
        const sp = invPriceMap[itemNo]?.supply || 0;
        let grade = 'C';
        if (sp >= 300000) grade = 'S';
        else if (sp >= 100000) grade = 'A';
        else if (sp >= 50000) grade = 'B';
        const wine = wineMap.get(itemNo);
        return {
          item_no: itemNo,
          item_name: agg.name,
          buy_count: agg.count,
          last_date: agg.lastDate,
          avg_unit_price: agg.count > 0 ? Math.round(agg.totalPrice / agg.count) : 0,
          supply_price: sp,
          grade,
          country: wine?.country || '',
          wine_type: wine?.wine_type || extractTypeFromName(agg.name),
        };
      });

    const purchasedItemNos = new Set(Object.keys(purchaseAgg));
    const maxCountryBuy = Math.max(...Object.values(countryCount), 1);
    const maxGrapeBuy = Math.max(...Object.values(grapeCount), 1);
    const maxTypeBuy = Math.max(...Object.values(typeCount), 1);
    const clientAvgPrice = avgPrice;
    const currentMonth = now.getMonth() + 1;
    const seasonInfo = getSeasonInfo(currentMonth);
    let maxSales90d = 1;
    for (const inv of inventory) { if ((inv.avg_sales_90d || 0) > maxSales90d) maxSales90d = inv.avg_sales_90d; }

    const threeMonthsAgoStr = threeStr;

    // ── 가격대 필터링 범위 계산 ──
    const hasPurchaseHistory = totalPurchases > 0 && avgPrice > 0;
    const priceFloor = hasPurchaseHistory ? Math.max(avgPrice * 0.3, 10000) : 15000;
    const priceCeiling = hasPurchaseHistory ? avgPrice * 3.0 : 500000;

    interface ScoredItem {
      item_no: string; item_name: string; score: number;
      tags: string[]; reason: string; price: number; stock: number;
      country: string; region: string; grape: string; wine_type: string;
      brand: string;
    }

    const scored: ScoredItem[] = [];

    for (const inv of inventory) {
      const itemNo = inv.item_no;
      const wine = wineMap.get(itemNo);
      const invCountry = wine?.country || wine?.country_en || inv.country || '';
      let invGrapes = wine?.grape_varieties || '';
      if (!invGrapes && inv.item_name) {
        const extracted = extractGrapesFromName(inv.item_name);
        if (extracted.length > 0) invGrapes = extracted.join(', ');
      }
      let wineType = wine?.wine_type || '';
      if (!wineType && inv.item_name) wineType = extractTypeFromName(inv.item_name);
      const invPrice = inv.supply_price || 0;
      let score = 0;
      const tags: string[] = [];
      const reasons: string[] = [];
      const purchase = purchaseAgg[itemNo];

      // ── 재주문 아이템 처리 ──
      if (purchase) {
        const isStale = !purchase.lastDate || purchase.lastDate <= threeMonthsAgoStr;
        if (purchase.count >= 2 && isStale) {
          const buyRatio = Math.min(purchase.count / Math.max(totalPurchases * 0.05, 3), 1);
          score += W.REORDER * buyRatio;
          tags.push('재주문');
          reasons.push(`${purchase.count}회 구매`);
        }
        if (!tags.includes('재주문')) continue;
      }

      // ── 신규 추천 아이템 처리 ──
      if (!purchase) {
        // 가격대 필터: 범위 밖이면 skip (재주문은 위에서 이미 처리)
        if (invPrice > 0 && (invPrice < priceFloor || invPrice > priceCeiling)) continue;

        if (invCountry && countryCount[invCountry]) {
          score += W.COUNTRY_MATCH * (countryCount[invCountry] / maxCountryBuy);
          tags.push('선호국가');
        }
        if (invGrapes) {
          for (const [grape, cnt] of Object.entries(grapeCount)) {
            if (invGrapes.toLowerCase().includes(grape.toLowerCase())) {
              score += W.GRAPE_MATCH * (cnt / maxGrapeBuy);
              tags.push('선호품종');
              break;
            }
          }
        }
        if (wineType && typeCount[wineType]) {
          score += W.TYPE_MATCH * (typeCount[wineType] / maxTypeBuy);
          tags.push('선호타입');
        }

        // ── 개선된 가격 적합도 스코어링 ──
        if (clientAvgPrice > 0 && invPrice > 0) {
          const ratio = invPrice / clientAvgPrice;
          if (ratio >= 0.7 && ratio <= 1.3) {
            // ±30% 이내: 슬라이딩 보너스 (중심=1.0에서 멀수록 감소)
            const dist = Math.abs(1 - ratio) / 0.3; // 0~1
            score += W.PRICE_FIT * (1 - dist * 0.7); // 최소 30% 보너스
            tags.push('적정가격');
          } else if (ratio > 1.3 && ratio <= 2.0) {
            // 30~100% 비쌈: 약한 프리미엄 보너스
            const fit = 1 - (ratio - 1.3) / 0.7; // 1→0
            score += W.UPSELL * fit;
            tags.push('프리미엄');
          }
          // 30% 이상 저렴: 보너스 없음 → 자연스럽게 하위 랭크
        }

        let seasonMatched = false;
        for (const t of seasonInfo.types) { if (wineType.toLowerCase().includes(t.toLowerCase())) { seasonMatched = true; break; } }
        if (!seasonMatched) { for (const g of seasonInfo.grapes) { if (invGrapes.toLowerCase().includes(g.toLowerCase())) { seasonMatched = true; break; } } }
        if (seasonMatched) { score += W.SEASONAL; tags.push(seasonInfo.season); }
        const sales90d = inv.avg_sales_90d || 0;
        if (sales90d > 0) score += W.SALES_VELOCITY * (sales90d / maxSales90d);

        if (totalPurchases > 0 && !tags.some(t => ['선호국가', '선호품종', '선호타입', '적정가격'].includes(t))) continue;
        if (totalPurchases === 0 && tags.length === 0) continue;
      }

      scored.push({
        item_no: itemNo,
        item_name: inv.item_name,
        score: Math.round(score * 10) / 10,
        tags,
        reason: reasons.join(' · ') || tags.join(' · '),
        price: invPrice,
        stock: inv._totalStock ?? ((inv.available_stock || 0) + (inv.bonded_warehouse || 0)),
        country: invCountry,
        region: wine?.region || '',
        grape: invGrapes,
        wine_type: wineType,
        brand: inv.brand || '',
      });
    }

    // ── Step 1: 점수순 상위 15개 후보 선정 ──
    scored.sort((a, b) => b.score - a.score);
    const candidates = scored.slice(0, 15);

    // ── Step 2: brand 중복 제한 (같은 brand 최대 2개) ──
    const brandCount: Record<string, number> = {};
    const diversified: ScoredItem[] = [];
    for (const item of candidates) {
      const b = item.brand;
      if (b) {
        brandCount[b] = (brandCount[b] || 0) + 1;
        if (brandCount[b] > 2) continue;
      }
      diversified.push(item);
    }

    // ── Step 3: 최종 정렬 ──
    const typeOrder: Record<string, number> = { '레드': 0, '화이트': 1, '스파클링': 2, '로제': 3 };
    diversified.sort((a, b) => {
      // 재주문 우선
      const aReorder = a.tags.includes('재주문') ? 0 : 1;
      const bReorder = b.tags.includes('재주문') ? 0 : 1;
      if (aReorder !== bReorder) return aReorder - bReorder;
      // 점수대 그룹 (5점 단위)
      const aGroup = Math.floor(a.score / 5);
      const bGroup = Math.floor(b.score / 5);
      if (aGroup !== bGroup) return bGroup - aGroup;
      // 같은 점수대 내 타입 그룹
      const aType = typeOrder[a.wine_type] ?? 4;
      const bType = typeOrder[b.wine_type] ?? 4;
      if (aType !== bType) return aType - bType;
      // 같은 타입 내 가격 내림차순
      return b.price - a.price;
    });

    const recommendations = diversified.slice(0, 10);

    // ── 3. 최근 주문 5건 ──
    const recentOrders = shipments.slice(0, 5).map(s => ({
      item_name: s.item_name || s.item_no,
      ship_date: s.ship_date,
      quantity: s.quantity || 1,
    }));

    // ── 브리핑 데이터 구성 ──
    const aiBriefing = {
      generated_at: new Date().toISOString(),
      client_summary: clientSummary,
      avg_discount_rate: avgDiscountRate,
      purchased_items: purchasedItems,
      recommendations,
      recent_orders: recentOrders,
    };

    // ── meetings.ai_briefing에 저장 ──
    if (meetingId) {
      const { error: updateError } = await supabase
        .from('meetings')
        .update({ ai_briefing: aiBriefing })
        .eq('id', meetingId);
      if (updateError) console.error('Failed to save briefing to meeting:', updateError);
    }

    return NextResponse.json({
      success: true,
      client_name: clientName,
      client_code: clientCode,
      briefing: aiBriefing,
    });

  } catch (err) {
    console.error('POST /api/sales/meetings/briefing error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
