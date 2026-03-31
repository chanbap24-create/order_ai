import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { getSellingTotal } from '@/app/lib/priceUtils';

const BRAND_COUNTRY: Record<string, string> = {
  CH:'프랑스',LV:'프랑스',VA:'프랑스',ST:'스페인',MS:'이탈리아',WM:'프랑스',
  DE:'프랑스',HP:'미국',IC:'프랑스',DC:'프랑스',VC:'프랑스',DD:'프랑스',
  GH:'포르투갈',MM:'스페인',MR:'프랑스',MG:'프랑스',MB:'미국',CF:'프랑스',
  AD:'미국',TM:'미국',DF:'프랑스',OR:'이탈리아',CC:'프랑스',CO:'포르투갈',
  VG:'프랑스',LM:'프랑스',SM:'스페인',BL:'프랑스',RB:'프랑스',CK:'아르헨티나',
  SU:'프랑스',RO:'호주',LG:'프랑스',BR:'이탈리아',CD:'프랑스',CP:'프랑스',
  RG:'미국',BS:'이탈리아',AS:'이탈리아',AZ:'이탈리아',GT:'호주',FC:'이탈리아',RF:'영국',
};

// 품번 첫 글자 기반 상품 분류
const ITEM_CATEGORY_MAP: Record<string, string> = {
  '0': 'Champagne', '1': 'Sparkling', '2': 'Red', '3': 'White',
  '4': 'Rosé', '5': 'Icewine', '6': 'Grappa', '7': 'Set',
  '8': 'POS Material', '9': '자재',
  'A': 'Port', 'Z': '타사제품',
};
const WINE_CODES = new Set('0123456789AZ'.split(''));

function getItemCategory(itemNo: string): string | null {
  const first = (itemNo || '').charAt(0).toUpperCase();
  return ITEM_CATEGORY_MAP[first] || null;
}

// 품명에서 용량 추출
function inferVolume(itemName: string): string {
  const n = itemName || '';
  if (/3\s*L\b|3000\s*ml/i.test(n)) return '3L';
  if (/1\.5\s*L\b|1500\s*ml/i.test(n)) return '1.5L';
  if (/500\s*ml/i.test(n)) return '500ml';
  if (/375\s*ml/i.test(n)) return '375ml';
  if (/187\s*ml/i.test(n)) return '187ml';
  return '750ml';
}

// 빈티지 매칭용 사전 계산 캐시
function buildVintageMap(wineMap: Map<string, any>): Map<string, { abbr: string; data: any }[]> {
  const vintageMap = new Map<string, { abbr: string; data: any }[]>();
  for (const [k, v] of wineMap) {
    const base = k.slice(0, 2) + k.slice(4);
    const abbr = ((v.item_name_kr || '').match(/^([A-Z]{2})\s/) || [])[1] || '';
    if (!vintageMap.has(base)) vintageMap.set(base, []);
    vintageMap.get(base)!.push({ abbr, data: v });
  }
  return vintageMap;
}

// 와인 정보 매칭 (캐시 기반 O(1) 빈티지 매칭)
// 품명에서 브랜드 코드 추출: "CH 찰스 하이직 브륏" → "CH"
function extractBrandCode(itemName: string): string | null {
  const m = (itemName || '').match(/^([A-Z]{2,3})\s/);
  return m ? m[1] : null;
}

function resolveWine(
  itemNo: string, itemName: string,
  wineMap: Map<string, any>, invMap: Map<string, string>,
  brandCountry: Map<string, string>, vintageMap: Map<string, { abbr: string; data: any }[]>,
): { country: string | null; region: string | null; wineType: string | null; brandCode: string | null } {
  let country: string | null = null, region: string | null = null, wineType: string | null = null;

  // 브랜드 코드: 품명에서 직접 추출 (wines 테이블 무관)
  const brandCode = extractBrandCode(itemName);

  const w = wineMap.get(itemNo);
  if (w) { country = w.country; region = w.region; wineType = w.wine_type; }
  if (!country) country = invMap.get(itemNo) || null;
  if (!country) {
    const base = itemNo.slice(0, 2) + itemNo.slice(4);
    const nameAbbr = (itemName.match(/^([A-Z]{2})\s/) || [])[1] || '';
    const candidates = vintageMap.get(base);
    if (candidates) {
      for (const c of candidates) {
        if (nameAbbr && c.abbr && nameAbbr !== c.abbr) continue;
        country = c.data.country; region = c.data.region; wineType = c.data.wine_type; break;
      }
    }
  }
  if (!country) {
    if (brandCode && brandCountry.has(brandCode)) country = brandCountry.get(brandCode)!;
  }
  // 품번 첫 글자 기반 분류 우선
  const codeCategory = getItemCategory(itemNo);
  if (codeCategory) wineType = codeCategory;
  return { country, region, wineType, brandCode };
}

// 지역 그룹: label → 검색 키워드들 (해당 키워드가 region 값에 포함되면 매칭)
const REGION_GROUPS: Record<string, { label: string; keywords: string[] }[]> = {
  '프랑스': [
    { label: '부르고뉴', keywords: ['Bourgogne','Burgundy','Chablis','Nuits','Beaune','Beaujolais','Chalonnaise','Mâconnais','Maconnais','Meursault','Mersault','Puligny','Chassagne','Volnay','Pommard','Gevrey','Chambertin','Chambolle','Musigny','Vosne','Romanee','Romanée','Corton','Aloxe','Montrachet','Aligote','Aligoté','Fixin','Marsannay','Monthelie','Auxey','Rully','Mercurey','Saint Aubin','Chorey','Savigny','Santenay','Clos de Vougeot','Irancy'] },
    { label: '보르도', keywords: ['Bordeaux','Médoc','Medoc','Graves','Sauternes','Pauillac','Saint-Emilion','Saint Emilion','Pomerol','Margaux','Haut-Médoc','Pessac'] },
    { label: '론', keywords: ['Rhône','Rhone','Condrieu','Hermitage','Cornas','Saint Joseph','Chateauneuf','Châteauneuf','Cotes du Rhone','Côtes du Rhône','Luberon','Gigondas','Vacqueyras'] },
    { label: '샴페인', keywords: ['Champagne','Charly-sur-Marne'] },
    { label: '알자스', keywords: ['Alsace'] },
    { label: '루아르', keywords: ['Loire','Sancerre','Chinon','Vouvray','Muscadet'] },
    { label: '랑그독', keywords: ['Languedoc'] },
    { label: '프로방스', keywords: ['Provence'] },
    { label: '크레망', keywords: ['Crémant','Cremant'] },
  ],
  '이탈리아': [
    { label: '토스카나', keywords: ['Toscan','Tuscan','Chianti','Bolgheri','Montalcino','Montepulciano'] },
    { label: '피에몬테', keywords: ['Piemont','Piedmont','Barolo','Barbaresco','Asti','Langhe'] },
    { label: '베네토', keywords: ['Veneto','Valpolicella','Soave','Prosecco'] },
    { label: '시칠리아', keywords: ['Sicil'] },
    { label: '풀리아', keywords: ['Puglia'] },
    { label: '캄파니아', keywords: ['Campania'] },
  ],
  '칠레': [
    { label: '센트럴 밸리', keywords: ['Central'] },
    { label: '마이포', keywords: ['Maipo'] },
    { label: '콜차구아', keywords: ['Colchagua'] },
    { label: '카사블랑카', keywords: ['Casablanca'] },
    { label: '아콩카과', keywords: ['Aconcagua'] },
    { label: '레이다', keywords: ['Leyda'] },
  ],
  '포르투갈': [
    { label: '도우로', keywords: ['Douro'] },
    { label: '알렌테주', keywords: ['Alentejo'] },
    { label: '다옹', keywords: ['Dao','Dão'] },
    { label: '마데이라', keywords: ['Madeira'] },
  ],
  '호주': [
    { label: '바로사', keywords: ['Barossa'] },
    { label: '맥라렌 베일', keywords: ['McLaren'] },
    { label: '마가렛 리버', keywords: ['Margaret'] },
    { label: '이든 밸리', keywords: ['Eden'] },
  ],
  '미국': [
    { label: '나파 밸리', keywords: ['Napa'] },
    { label: '소노마', keywords: ['Sonoma'] },
    { label: '캘리포니아', keywords: ['California'] },
    { label: '오레곤', keywords: ['Oregon'] },
  ],
  '뉴질랜드': [
    { label: '말보로', keywords: ['Marlborough'] },
    { label: '혹스 베이', keywords: ['Hawke'] },
  ],
  '스페인': [
    { label: '리오하', keywords: ['Rioja'] },
    { label: '프리오랏', keywords: ['Priorat'] },
    { label: '리베라 델 두에로', keywords: ['Ribera'] },
  ],
};

// 하위 지역 그룹: 지역 > 세부 지역
const SUB_REGION_GROUPS: Record<string, Record<string, { label: string; keywords: string[] }[]>> = {
  '프랑스': {
    '부르고뉴': [
      { label: '샤블리', keywords: ['Chablis'] },
      { label: '코트 드 뉘', keywords: ['Nuits','Gevrey','Chambertin','Chambolle','Musigny','Vosne','Romanee','Romanée','Fixin','Marsannay','Clos de Vougeot','Nuits St'] },
      { label: '코트 드 본', keywords: ['Beaune','Meursault','Mersault','Puligny','Chassagne','Volnay','Pommard','Corton','Aloxe','Montrachet','Monthelie','Auxey','Saint Aubin','Chorey','Savigny','Santenay','Blagny'] },
      { label: '보졸레', keywords: ['Beaujolais'] },
      { label: '마코네', keywords: ['Mâconnais','Maconnais','Macon'] },
      { label: '부르고뉴 기타', keywords: ['Bourgogne','Burgundy','Aligote','Aligoté','Rully','Mercurey','Chalonnaise','Irancy','Auxerre','Crémant de Bourgogne'] },
    ],
    '보르도': [
      { label: '메독', keywords: ['Médoc','Medoc','Margaux','Pauillac','Saint-Julien','Saint-Estephe','Haut-Médoc'] },
      { label: '우안', keywords: ['Saint-Emilion','Saint Emilion','Pomerol'] },
      { label: '그라브/소테른', keywords: ['Graves','Sauternes','Pessac','Barsac'] },
      { label: '보르도 기타', keywords: ['Bordeaux'] },
    ],
    '론': [
      { label: '북부 론', keywords: ['Northern Rhône','Condrieu','Hermitage','Cornas','Saint Joseph','Cote Rotie','Côte-Rôtie'] },
      { label: '남부 론', keywords: ['Southern Rhône','Chateauneuf','Châteauneuf','Gigondas','Vacqueyras','Luberon','Cotes du Rhone','Côtes du Rhône','Ventoux'] },
    ],
  },
  '이탈리아': {
    '토스카나': [
      { label: '키안티', keywords: ['Chianti'] },
      { label: '볼게리', keywords: ['Bolgheri'] },
      { label: '몬탈치노', keywords: ['Montalcino'] },
      { label: '토스카나 기타', keywords: ['Toscan','Tuscan'] },
    ],
    '피에몬테': [
      { label: '바롤로', keywords: ['Barolo'] },
      { label: '바르바레스코', keywords: ['Barbaresco'] },
      { label: '피에몬테 기타', keywords: ['Piemont','Piedmont','Asti','Langhe'] },
    ],
  },
};

// 하위 지역 그룹 label로 변환
function resolveSubRegion(country: string, regionGroup: string, region: string): string {
  const subs = SUB_REGION_GROUPS[country]?.[regionGroup];
  if (!subs) return region;
  for (const s of subs) {
    if (matchRegionGroup(region, s.keywords)) return s.label;
  }
  return region;
}

// region 값이 특정 그룹에 속하는지 확인
function matchRegionGroup(region: string, keywords: string[]): boolean {
  const r = region.toLowerCase();
  return keywords.some(kw => r.includes(kw.toLowerCase()));
}

// region 값을 그룹 label로 변환
function resolveRegionGroup(country: string, region: string): string {
  const groups = REGION_GROUPS[country];
  if (!groups) return region;
  for (const g of groups) {
    if (matchRegionGroup(region, g.keywords)) return g.label;
  }
  return region;
}

// GET /api/marketing/sales-analysis?start_date=2024-01-01&end_date=2026-03-31&country=프랑스&region=부르고뉴&wine_type=레드
// 필터 없으면 전체 조회. 필터 있으면 해당 조건만.
// mode=options → 선택 가능한 국가/지역/타입 목록 반환
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const filterCountry = searchParams.get('country') || '';
    const filterRegion = searchParams.get('region') || '';
    const filterType = searchParams.get('wine_type') || '';
    const filterVolume = searchParams.get('volume') || '';
    const filterSubRegion = searchParams.get('sub_region') || '';
    const filterBrand = searchParams.get('brand') || '';

    // wines/inventory 병렬 로드
    const [{ data: wines }, { data: inv }] = await Promise.all([
      supabase.from('wines').select('item_code, item_name_kr, country, region, wine_type, supplier_kr, supplier').not('item_code', 'like', 'D%'),
      supabase.from('inventory_cdv').select('item_no, country'),
    ]);
    const wineMap = new Map<string, any>();
    for (const w of (wines || [])) wineMap.set(w.item_code, w);
    const invMap = new Map<string, string>();
    for (const r of (inv || [])) if (r.country) invMap.set(r.item_no, r.country);

    const brandCountry = new Map<string, string>();
    for (const w of (wines || [])) {
      const m = (w.item_name_kr || '').match(/^([A-Z]{2})\s/);
      if (m && w.country) brandCountry.set(m[1], w.country);
    }
    for (const [k, v] of Object.entries(BRAND_COUNTRY)) {
      if (!brandCountry.has(k)) brandCountry.set(k, v);
    }

    // 브랜드 코드 → 한글명 매핑 (wines 테이블에서 자동 생성)
    const brandNameMap = new Map<string, string>(); // CH → 찰스하이직
    for (const w of (wines || [])) {
      const m = (w.item_name_kr || '').match(/^([A-Z]{2,3})\s+(.+)/);
      if (m) {
        const code = m[1];
        if (!brandNameMap.has(code)) {
          // supplier_kr 우선, 없으면 품명에서 첫 단어
          const supplierKr = w.supplier_kr || w.supplier || '';
          const nameFirst = m[2].split(/\s/)[0];
          brandNameMap.set(code, supplierKr || nameFirst);
        }
      }
    }

    // mode=options: 선택 가능한 필터 값 목록 (지역 그룹 기반)
    if (mode === 'options') {
      const countries = new Set<string>();
      for (const w of (wines || [])) {
        if (w.country) countries.add(w.country);
      }
      const types = new Set(Object.values(ITEM_CATEGORY_MAP));
      // 지역은 그룹 label로 반환
      const regionsObj: Record<string, string[]> = {};
      for (const [c, groups] of Object.entries(REGION_GROUPS)) {
        regionsObj[c] = groups.map(g => g.label);
      }
      // 하위 지역 label 목록
      const subRegionsObj: Record<string, Record<string, string[]>> = {};
      for (const [c, regionMap] of Object.entries(SUB_REGION_GROUPS)) {
        subRegionsObj[c] = {};
        for (const [rg, subs] of Object.entries(regionMap)) {
          subRegionsObj[c][rg] = subs.map(s => s.label);
        }
      }
      // 브랜드 목록: code + name
      const brands = [...brandNameMap.entries()]
        .map(([code, name]) => ({ code, name }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return NextResponse.json({
        countries: [...countries].sort(),
        regions: regionsObj,
        sub_regions: subRegionsObj,
        types: [...types].sort(),
        brands,
        volumes: ['750ml', '375ml', '500ml', '1.5L', '3L', '187ml'],
      });
    }

    // 기간 필수
    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'start_date, end_date required' }, { status: 400 });
    }

    // 빈티지 매칭 캐시 사전 계산 + 품번별 매칭 결과 캐시
    const vintageMap = buildVintageMap(wineMap);
    const resolveCache = new Map<string, { country: string | null; region: string | null; wineType: string | null }>();

    // shipments 집계
    type ItemAgg = { item_no: string; item_name: string; qty: number; amount: number; country: string; region: string | null; wineType: string | null };
    const itemAgg: Record<string, ItemAgg> = {};
    const monthlyQty: Record<string, number> = {};
    let totalQty = 0, matchedCountry = 0, matchedRegion = 0, matchedType = 0;

    // shipments 병렬 fetch: 먼저 총 건수 → 병렬로 모든 페이지 동시 요청
    const { count: shipCount } = await supabase.from('shipments')
      .select('*', { count: 'exact', head: true })
      .gte('ship_date', startDate).lte('ship_date', endDate);
    const batch = 1000;
    const pages = Math.ceil((shipCount || 0) / batch);
    const concurrency = 6;
    const allShipments: any[] = [];
    for (let i = 0; i < pages; i += concurrency) {
      const promises = [];
      for (let j = i; j < Math.min(i + concurrency, pages); j++) {
        promises.push(
          supabase.from('shipments')
            .select('item_no, item_name, quantity, unit_price, selling_price, supply_amount, ship_date')
            .gte('ship_date', startDate).lte('ship_date', endDate)
            .range(j * batch, (j + 1) * batch - 1)
            .then(r => r.data || [])
        );
      }
      const results = await Promise.all(promises);
      for (const r of results) allShipments.push(...r);
    }

    for (const r of allShipments) {
        if (!r.item_no || r.item_no.length < 5) continue;
        const firstChar = r.item_no.charAt(0).toUpperCase();
        if (!WINE_CODES.has(firstChar)) continue;
        const qty = r.quantity || 0;
        if (qty === 0) continue;

        let resolved = resolveCache.get(r.item_no);
        if (!resolved) {
          resolved = resolveWine(r.item_no, r.item_name || '', wineMap, invMap, brandCountry, vintageMap);
          resolveCache.set(r.item_no, resolved);
        }
        const { country, region, wineType, brandCode } = resolved;

        // 필터 적용
        if (filterBrand && brandCode !== filterBrand) continue;
        if (filterCountry && country !== filterCountry) continue;
        if (filterRegion && country) {
          if (!region) continue;
          // 필터가 지역 그룹 label인지 확인
          const groups = REGION_GROUPS[country];
          const group = groups?.find(g => g.label === filterRegion);
          if (group) {
            if (!matchRegionGroup(region, group.keywords)) continue;
          } else {
            if (!region.toLowerCase().includes(filterRegion.toLowerCase())) continue;
          }
        }
        if (filterType && wineType !== filterType) continue;
        if (filterVolume) {
          const vol = inferVolume(r.item_name || '');
          if (vol !== filterVolume) continue;
        }
        if (filterSubRegion && country && region) {
          const regionGroup = resolveRegionGroup(country, region);
          const subs = SUB_REGION_GROUPS[country]?.[regionGroup];
          if (subs) {
            const sub = subs.find(s => s.label === filterSubRegion);
            if (sub && !matchRegionGroup(region, sub.keywords)) continue;
            if (!sub) continue;
          } else {
            continue;
          }
        }

        // 총액 판별 (priceUtils)
        const amount = getSellingTotal(r.unit_price || 0, r.selling_price || 0, r.supply_amount || 0, qty);

        // 순수 판매량/금액 (반품은 차감)
        totalQty += qty; // 반품 차감
        if (country) matchedCountry += absQty;
        if (region) matchedRegion += absQty;
        if (wineType) matchedType += absQty;

        const month = (r.ship_date || '').slice(0, 7);
        monthlyQty[month] = (monthlyQty[month] || 0) + qty;

        const key = r.item_no;
        if (!itemAgg[key]) {
          itemAgg[key] = { item_no: r.item_no, item_name: r.item_name || '', qty: 0, amount: 0, country: country || '', region, wineType, brandCode };
        }
        itemAgg[key].qty += qty; // 반품 차감
        itemAgg[key].amount += amount;
      }

    // 국가별 집계
    const countryAgg: Record<string, { qty: number; amount: number; items: number; types: Record<string, number> }> = {};
    const regionAgg: Record<string, Record<string, { qty: number; amount: number }>> = {};
    const typeAgg: Record<string, { qty: number; amount: number }> = {};
    const monthlyDetail: Record<string, { qty: number; amount: number }> = {};
    let totalAmount = 0;

    for (const item of Object.values(itemAgg)) {
      if (item.qty <= 0) continue; // 반품이 판매보다 많은 품목 제외
      totalAmount += item.amount;
      if (item.country) {
        if (!countryAgg[item.country]) countryAgg[item.country] = { qty: 0, amount: 0, items: 0, types: {} };
        countryAgg[item.country].qty += item.qty;
        countryAgg[item.country].amount += item.amount;
        countryAgg[item.country].items += 1;
        if (item.wineType) {
          countryAgg[item.country].types[item.wineType] = (countryAgg[item.country].types[item.wineType] || 0) + item.qty;
        }
        if (item.region) {
          if (!regionAgg[item.country]) regionAgg[item.country] = {};
          const groupLabel = resolveRegionGroup(item.country, item.region);
          // 지역 필터가 있으면 하위 지역으로 세분화
          const displayLabel = filterRegion
            ? resolveSubRegion(item.country, groupLabel, item.region)
            : groupLabel;
          if (!regionAgg[item.country][displayLabel]) regionAgg[item.country][displayLabel] = { qty: 0, amount: 0 };
          regionAgg[item.country][displayLabel].qty += item.qty;
          regionAgg[item.country][displayLabel].amount += item.amount;
        }
      }
      if (item.wineType) {
        if (!typeAgg[item.wineType]) typeAgg[item.wineType] = { qty: 0, amount: 0 };
        typeAgg[item.wineType].qty += item.qty;
        typeAgg[item.wineType].amount += item.amount;
      }
    }

    // 월별 금액 집계 (별도 루프)
    for (const item of Object.values(itemAgg)) {
      // monthlyDetail은 이미 monthlyQty에서 qty만 있으므로, item 기준으로 못 함
      // 대신 monthlyQty를 monthlyDetail로 확장 (amount는 shipments 루프에서 해야 함)
    }

    const countries = Object.entries(countryAgg)
      .map(([name, d]) => ({
        name, qty: d.qty, amount: d.amount, items: d.items, avg_price: d.qty > 0 ? Math.round(d.amount / d.qty) : 0,
        types: Object.entries(d.types).map(([t, q]) => ({ name: t, qty: q })).sort((a, b) => b.qty - a.qty),
      }))
      .sort((a, b) => b.qty - a.qty);

    const regions: Record<string, { name: string; qty: number; amount: number; avg_price: number }[]> = {};
    for (const [c, regs] of Object.entries(regionAgg)) {
      regions[c] = Object.entries(regs)
        .map(([name, d]) => ({ name, qty: d.qty, amount: d.amount, avg_price: d.qty > 0 ? Math.round(d.amount / d.qty) : 0 }))
        .sort((a, b) => b.qty - a.qty);
    }

    const types = Object.entries(typeAgg)
      .map(([name, d]) => ({ name, qty: d.qty, amount: d.amount, avg_price: d.qty > 0 ? Math.round(d.amount / d.qty) : 0 }))
      .sort((a, b) => b.qty - a.qty);

    // 품목별
    const topItems = Object.values(itemAgg).filter(i => i.qty > 0).sort((a, b) => b.qty - a.qty)
      .map(({ item_no, item_name, qty, amount, country, region, wineType, brandCode: bc }) => ({
        item_no, item_name, qty, amount, avg_price: qty > 0 ? Math.round(amount / qty) : 0,
        country, region: region ? resolveRegionGroup(country || '', region) : null, wine_type: wineType,
        brand_code: bc, brand_name: bc ? brandNameMap.get(bc) || bc : null,
      }));

    // 월별 추이
    const monthly = Object.entries(monthlyQty).sort(([a], [b]) => a.localeCompare(b))
      .map(([month, qty]) => ({ month, qty }));

    // 기간 일수로 일평균 계산
    const dayMs = 1000 * 60 * 60 * 24;
    const days = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / dayMs));
    const dailyAvg = Math.round(totalQty / days);
    const monthlyAvg = Math.round(totalQty / Math.max(1, monthly.length));

    return NextResponse.json({
      total_qty: totalQty,
      total_amount: totalAmount,
      total_items: Object.keys(itemAgg).length,
      daily_avg: dailyAvg,
      monthly_avg: monthlyAvg,
      match_rate: {
        country: totalQty > 0 ? Math.round(matchedCountry / totalQty * 100) : 0,
        region: totalQty > 0 ? Math.round(matchedRegion / totalQty * 100) : 0,
        type: totalQty > 0 ? Math.round(matchedType / totalQty * 100) : 0,
      },
      countries,
      regions,
      types,
      top_items: topItems,
      monthly,
    });
  } catch (err) {
    console.error('GET /api/marketing/sales-analysis error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
