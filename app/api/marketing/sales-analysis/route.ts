import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

const BRAND_COUNTRY: Record<string, string> = {
  CH:'프랑스',LV:'프랑스',VA:'프랑스',ST:'스페인',MS:'이탈리아',WM:'프랑스',
  DE:'프랑스',HP:'미국',IC:'프랑스',DC:'프랑스',VC:'프랑스',DD:'프랑스',
  GH:'포르투갈',MM:'스페인',MR:'프랑스',MG:'프랑스',MB:'미국',CF:'프랑스',
  AD:'미국',TM:'미국',DF:'프랑스',OR:'이탈리아',CC:'프랑스',CO:'포르투갈',
  VG:'프랑스',LM:'프랑스',SM:'스페인',BL:'프랑스',RB:'프랑스',CK:'아르헨티나',
  SU:'프랑스',RO:'호주',LG:'프랑스',BR:'이탈리아',CD:'프랑스',CP:'프랑스',
  RG:'미국',BS:'이탈리아',AS:'이탈리아',AZ:'이탈리아',GT:'호주',FC:'이탈리아',
};

function inferType(name: string): string | null {
  const n = (name || '').toLowerCase();
  if (/로제|rosé|rosato/.test(n)) return '로제';
  if (/스파클링|브륏|brut|크레망|crémant|샴페인|champagne|프로세코|카바|cava/.test(n)) return '스파클링';
  if (/포트|포르트|마데이라|셰리|주정강화|토니|tawny/.test(n)) return '주정강화';
  if (/소비뇽 블랑|샤르도네|리슬링|비오니에|피노 그리|그뤼너|게뷔르츠|모스카토|블랑|비앙코|branco|blanc|white|알바리뇨|베르멘티노|토론테스|화이트/.test(n)) return '화이트';
  if (/카베르네|메를로|피노누아|피노 누아|시라|시라즈|템프라니요|산지오베제|네비올로|말벡|진판델|그르나슈|클라렛|레드|rosso|tinto|rouge|가메|바르베라|돌체토|아글리아니코|카르메네르/.test(n)) return '레드';
  return null;
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

// 와인 정보 매칭
function resolveWine(
  itemNo: string, itemName: string,
  wineMap: Map<string, any>, invMap: Map<string, string>, brandCountry: Map<string, string>,
): { country: string | null; region: string | null; wineType: string | null } {
  let country: string | null = null, region: string | null = null, wineType: string | null = null;

  const w = wineMap.get(itemNo);
  if (w) { country = w.country; region = w.region; wineType = w.wine_type; }
  if (!country) country = invMap.get(itemNo) || null;
  if (!country) {
    // 빈티지 매칭: 품번 base 동일 + 품명 브랜드약어(앞 2글자) 동일해야 매칭
    const base = itemNo.slice(0, 2) + itemNo.slice(4);
    const nameAbbr = (itemName.match(/^([A-Z]{2})\s/) || [])[1] || '';
    for (const [k, v] of wineMap) {
      if (k.slice(0, 2) + k.slice(4) === base) {
        const vAbbr = ((v.item_name_kr || '').match(/^([A-Z]{2})\s/) || [])[1] || '';
        if (nameAbbr && vAbbr && nameAbbr !== vAbbr) continue; // 브랜드 다르면 스킵
        country = v.country; region = v.region; wineType = v.wine_type; break;
      }
    }
  }
  if (!country) {
    const m = (itemName || '').match(/^([A-Z]{2,3})\s/);
    if (m && brandCountry.has(m[1])) country = brandCountry.get(m[1])!;
  }
  if (!wineType) wineType = inferType(itemName || '');
  return { country, region, wineType };
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

    // wines/inventory 로드
    const { data: wines } = await supabase.from('wines')
      .select('item_code, item_name_kr, country, region, wine_type')
      .not('item_code', 'like', 'D%');
    const wineMap = new Map<string, any>();
    for (const w of (wines || [])) wineMap.set(w.item_code, w);

    const { data: inv } = await supabase.from('inventory_cdv').select('item_no, country');
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

    // mode=options: 선택 가능한 필터 값 목록 (지역 그룹 기반)
    if (mode === 'options') {
      const countries = new Set<string>();
      const types = new Set<string>();
      for (const w of (wines || [])) {
        if (w.country) countries.add(w.country);
        if (w.wine_type) types.add(w.wine_type);
      }
      // 지역은 그룹 label로 반환
      const regionsObj: Record<string, string[]> = {};
      for (const [c, groups] of Object.entries(REGION_GROUPS)) {
        regionsObj[c] = groups.map(g => g.label);
      }
      return NextResponse.json({
        countries: [...countries].sort(),
        regions: regionsObj,
        types: [...types].sort(),
        volumes: ['750ml', '375ml', '500ml', '1.5L', '3L', '187ml'],
      });
    }

    // 기간 필수
    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'start_date, end_date required' }, { status: 400 });
    }

    // shipments 집계
    type ItemAgg = { item_no: string; item_name: string; qty: number; amount: number; country: string; region: string | null; wineType: string | null };
    const itemAgg: Record<string, ItemAgg> = {};
    const monthlyQty: Record<string, number> = {};
    let totalQty = 0, matchedCountry = 0, matchedRegion = 0, matchedType = 0;

    let offset = 0;
    const batch = 1000;
    while (true) {
      const { data, error } = await supabase.from('shipments')
        .select('item_no, item_name, quantity, selling_price, ship_date')
        .gte('ship_date', startDate).lte('ship_date', endDate)
        .range(offset, offset + batch - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;

      for (const r of data) {
        if (!r.item_no || r.item_no.length < 5 || r.item_no.startsWith('D') || r.item_no.startsWith('9F')) continue;
        if (/^7[0-9A-Z]/.test(r.item_no) && (r.item_name || '').includes('특판')) continue;
        const qty = r.quantity || 0;
        if (qty === 0) continue;

        const { country, region, wineType } = resolveWine(r.item_no, r.item_name || '', wineMap, invMap, brandCountry);

        // 필터 적용
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

        // 총액 판별: sp*qty≈sa → sp는 단가, sa가 총액. 아니면 sp 자체가 총액.
        const sp = r.selling_price || 0;
        const sa = r.supply_amount || 0;
        const absQty = Math.abs(qty);
        let amount: number;
        if (absQty <= 1) {
          amount = sp; // qty=1이면 단가=총액 (부호 유지: 반품은 음수)
        } else if (sa !== 0 && Math.abs(sp * absQty - Math.abs(sa)) < 100) {
          amount = qty > 0 ? Math.abs(sa) : -Math.abs(sa); // sp는 단가, sa가 총액
        } else {
          amount = sp; // sp 자체가 총액 (부호 유지)
        }

        // 순수 판매량/금액 (반품은 차감)
        totalQty += qty; // 반품 차감
        if (country) matchedCountry += absQty;
        if (region) matchedRegion += absQty;
        if (wineType) matchedType += absQty;

        const month = (r.ship_date || '').slice(0, 7);
        monthlyQty[month] = (monthlyQty[month] || 0) + qty;

        const key = r.item_no;
        if (!itemAgg[key]) {
          itemAgg[key] = { item_no: r.item_no, item_name: r.item_name || '', qty: 0, amount: 0, country: country || '', region, wineType };
        }
        itemAgg[key].qty += qty; // 반품 차감
        itemAgg[key].amount += amount;
      }
      if (data.length < batch) break;
      offset += batch;
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
          if (!regionAgg[item.country][groupLabel]) regionAgg[item.country][groupLabel] = { qty: 0, amount: 0 };
          regionAgg[item.country][groupLabel].qty += item.qty;
          regionAgg[item.country][groupLabel].amount += item.amount;
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
      .map(({ item_no, item_name, qty, amount, country, region, wineType }) => ({
        item_no, item_name, qty, amount, avg_price: qty > 0 ? Math.round(amount / qty) : 0,
        country, region: region ? resolveRegionGroup(country || '', region) : null, wine_type: wineType,
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
