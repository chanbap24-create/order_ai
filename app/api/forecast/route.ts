import { supabase } from '@/app/lib/db';
import { NextResponse } from 'next/server';

const MANAGERS = ['백근철', '성창우', '김효직', '김기범', '조성재', '김동현', '박경아', '송원상'];

// 브랜드 약어 → 국가 매핑 (sales-analysis와 동일)
const BRAND_COUNTRY: Record<string, string> = {
  CH:'프랑스',LV:'프랑스',VA:'프랑스',ST:'스페인',MS:'이탈리아',WM:'프랑스',
  DE:'프랑스',HP:'미국',IC:'프랑스',DC:'프랑스',VC:'프랑스',DD:'프랑스',
  GH:'포르투갈',MM:'스페인',MR:'프랑스',MG:'프랑스',MB:'미국',CF:'프랑스',
  AD:'미국',TM:'미국',DF:'프랑스',OR:'이탈리아',CC:'프랑스',CO:'포르투갈',
  VG:'프랑스',LM:'프랑스',SM:'스페인',BL:'프랑스',RB:'프랑스',CK:'아르헨티나',
  SU:'프랑스',RO:'호주',LG:'프랑스',BR:'이탈리아',CD:'프랑스',CP:'프랑스',
  RG:'미국',BS:'이탈리아',AS:'이탈리아',AZ:'이탈리아',GT:'호주',FC:'이탈리아',
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { country, regionSearch, wineType, supplyPrice, priceMin, priceMax, startYear, endYear, isNewItem, excludeWineNames, excludeBulkSales, bulkThreshold: rawBulkThreshold, excludeSamples, noCorrection, excludeBusinessTypes } = body;
    const bulkThreshold = Number(rawBulkThreshold) || 60;

    if (!country) {
      return NextResponse.json({ error: '국가는 필수입니다' }, { status: 400 });
    }

    // 공급가 범위 결정
    let pMin: number, pMax: number, priceLabel: string;
    if (priceMin !== undefined || priceMax !== undefined) {
      pMin = Number(priceMin) || 0;
      pMax = Number(priceMax) || 999999999;
      priceLabel = `${pMin.toLocaleString()}~${pMax.toLocaleString()}원`;
    } else if (supplyPrice) {
      const range = getPriceRange(supplyPrice);
      pMin = range.min; pMax = range.max; priceLabel = range.label;
    } else {
      return NextResponse.json({ error: '가격 범위를 지정해주세요' }, { status: 400 });
    }

    const priceRange = { label: priceLabel, min: pMin, max: pMax };
    const yearFrom = startYear || 2022;
    const yearTo = endYear || new Date().getFullYear();
    const analysisStart = `${yearFrom}-01-01`;
    const analysisEnd = `${yearTo}-12-31`;

    // ── 1단계: wines 조회 ──
    let wineQuery = supabase
      .from('wines')
      .select('item_code, item_name_kr, supply_price, avg_import_cost, region, grape_varieties, wine_type, country, supplier_kr')
      .eq('country', country)
      .gte('supply_price', pMin)
      .lt('supply_price', pMax)
      .limit(500);

    if (regionSearch) {
      const searchTerms = regionSearch.split(',').map((k: string) => k.trim());
      const countryMap: Record<string, string> = {
        '프랑스': '프랑스 France', '이탈리아': '이탈리아 Italy', '칠레': '칠레 Chile',
        '포르투갈': '포르투갈 Portugal', '호주': '호주 Australia', '미국': '미국 USA',
        '뉴질랜드': '뉴질랜드 New Zealand', '스페인': '스페인 Spain',
        '아르헨티나': '아르헨티나 Argentina', '독일': '독일 Germany',
      };
      const regionCountry = countryMap[country] || country;
      const { data: wineRegions } = await supabase
        .from('wine_regions')
        .select('major_region, sub_region, appellation')
        .eq('country', regionCountry);

      const matchedMajors = new Set<string>();
      for (const wr of wineRegions || []) {
        for (const term of searchTerms) {
          if (wr.major_region && (wr.major_region.includes(term) || term.includes(wr.major_region.split(' ')[0]))) {
            matchedMajors.add(wr.major_region);
          }
        }
      }

      const allKeywords = new Set<string>(searchTerms);
      for (const wr of wineRegions || []) {
        if (matchedMajors.has(wr.major_region)) {
          if (wr.sub_region) {
            const parts = wr.sub_region.split(/[\s-]+/);
            for (const p of parts) {
              const cleaned = p.replace(/[^A-Za-zÀ-ÿ]/g, '');
              if (cleaned.length > 2 && /[A-Za-z]/.test(cleaned)) allKeywords.add(cleaned);
            }
          }
        }
      }

      const extraKeywords: Record<string, string[]> = {
        'Meursault': ['Mersault'],
        'Bourgogne': ['Burgundy', 'Aligote', 'Monthelie', 'Auxerre'],
        'Barossa': ['Barossa Valley'],
      };
      for (const [key, extras] of Object.entries(extraKeywords)) {
        if (allKeywords.has(key)) { for (const e of extras) allKeywords.add(e); }
      }
      const orFilter = [...allKeywords].map(k => `region.ilike.%${k}%`).join(',');
      wineQuery = wineQuery.or(orFilter);
    }

    if (wineType) wineQuery = wineQuery.eq('wine_type', wineType);

    const { data: wines, error: wineErr } = await wineQuery;
    if (wineErr) return NextResponse.json({ error: 'DB 오류', detail: wineErr.message }, { status: 500 });

    const itemCodes = wines?.map(w => w.item_code) || [];
    if (itemCodes.length === 0) {
      const msg = regionSearch
        ? `해당 지역의 와인이 DB에 없습니다. 지역을 '전체'로 변경해 보세요.`
        : `해당 조건의 와인이 DB에 없습니다 (${country}, ${priceRange.label}).`;
      return NextResponse.json({ stats: [], priceRange, matchedItems: 0, message: msg });
    }

    const wineMap: Record<string, { name: string; price: number; importCost: number; region: string | null; grape: string | null; type: string | null; country: string | null; brand: string | null }> = {};
    for (const w of wines || []) {
      wineMap[w.item_code] = { name: w.item_name_kr, price: w.supply_price, importCost: w.avg_import_cost || 0, region: w.region, grape: w.grape_varieties, type: w.wine_type, country: w.country || null, brand: w.supplier_kr || null };
    }

    // ── 4-stage matching: 빈티지 변형 품번도 포함하여 출고 커버리지 확대 ──
    // Stage 1: 이미 매칭된 itemCodes (직접 매칭)
    // Stage 2-4: 빈티지 변형 품번 추가
    const allWinesRes = await supabase.from('wines').select('item_code, item_name_kr, supply_price, avg_import_cost, region, grape_varieties, wine_type, country, supplier_kr').not('item_code', 'like', 'D%');
    const allWinesList = allWinesRes.data || [];

    // 매칭된 와인의 빈티지 베이스 추출 (prefix 2자 + suffix from pos 4)
    const matchedBases = new Set<string>();
    const matchedAbbrSet = new Set<string>(); // 매칭된 와인의 브랜드 약어
    for (const code of itemCodes) {
      if (code.length >= 5) matchedBases.add(code.slice(0, 2) + code.slice(4));
      const w = wineMap[code];
      if (w?.name) {
        const m = w.name.match(/^([A-Z]{2})\s/);
        if (m) matchedAbbrSet.add(m[1]);
      }
    }

    // 전체 와인에서 같은 빈티지 베이스를 공유하는 다른 빈티지 품번 찾기
    const extraItemCodes: string[] = [];
    for (const w of allWinesList) {
      if (wineMap[w.item_code]) continue; // 이미 직접 매칭됨
      if (w.item_code.length < 5) continue;
      const base = w.item_code.slice(0, 2) + w.item_code.slice(4);
      if (matchedBases.has(base)) {
        // 브랜드 약어 확인: 이름 앞 약어가 매칭된 와인의 약어와 일치하는지 확인
        const nameAbbr = ((w.item_name_kr || '').match(/^([A-Z]{2})\s/) || [])[1] || '';
        if (nameAbbr && matchedAbbrSet.size > 0 && !matchedAbbrSet.has(nameAbbr)) continue;
        // 가격 범위 확인
        if (w.supply_price >= pMin && w.supply_price < pMax) {
          extraItemCodes.push(w.item_code);
          wineMap[w.item_code] = {
            name: w.item_name_kr, price: w.supply_price, importCost: w.avg_import_cost || 0,
            region: w.region, grape: w.grape_varieties, type: w.wine_type,
            country: w.country || null, brand: w.supplier_kr || null,
          };
        }
      }
    }

    // inventory_cdv에서 country 매칭되는 추가 품번 찾기 (wines 테이블에 없는 품번)
    const invRes = await supabase.from('inventory_cdv').select('item_no, country').eq('country', country);
    const invItems = invRes.data || [];
    const invCountryMap = new Map<string, string>();
    for (const inv of invItems) {
      if (inv.country) invCountryMap.set(inv.item_no, inv.country);
    }

    // 브랜드 약어 → 국가 매핑 구축 (매칭된 와인 기준 + fallback BRAND_COUNTRY)
    const brandCountryMap = new Map<string, string>();
    for (const w of allWinesList) {
      const m = (w.item_name_kr || '').match(/^([A-Z]{2})\s/);
      if (m && w.country) brandCountryMap.set(m[1], w.country);
    }
    for (const [k, v] of Object.entries(BRAND_COUNTRY)) {
      if (!brandCountryMap.has(k)) brandCountryMap.set(k, v);
    }

    // 모든 매칭된 품번 합치기
    const expandedItemCodes = [...new Set([...itemCodes, ...extraItemCodes])];

    const getWineName = (itemNo: string) => wineMap[itemNo]?.name || itemNo;

    // 제외 와인 필터링: 출고 조회 대상에서 제외하되, 전체 매칭 수는 별도 보존
    const allMatchedCount = expandedItemCodes.length;
    const excludeSet = new Set<string>(excludeWineNames || []);
    const activeItemCodes = excludeSet.size > 0
      ? expandedItemCodes.filter(code => !excludeSet.has(wineMap[code]?.name))
      : expandedItemCodes;

    // 제외된 와인 정보 (UI에서 재포함 버튼 표시용)
    const excludedWineList = excludeSet.size > 0
      ? expandedItemCodes.filter(code => excludeSet.has(wineMap[code]?.name))
          .reduce((acc, code) => {
            const name = wineMap[code]?.name;
            if (name && !acc.find(w => w.item_name === name)) {
              acc.push({ item_name: name, supply_price: wineMap[code]?.price || 0, region: wineMap[code]?.region || null });
            }
            return acc;
          }, [] as { item_name: string; supply_price: number; region: string | null }[])
      : [];

    if (activeItemCodes.length === 0) {
      return NextResponse.json({ stats: [], priceRange, matchedItems: 0, allMatchedItems: allMatchedCount, excludedWines: excludedWineList, message: '모든 와인이 제외되었습니다.' });
    }

    // ── 2단계: 전체 출고 데이터 조회 (재고소진 + 러닝커브용 전체 이력) ──
    type Shipment = { ship_date: string; quantity: number; item_no: string; client_name: string; manager: string; unit_price: number | null; selling_price: number | null; supply_amount: number | null; business_type: string | null };
    const allShipments: Shipment[] = [];

    // activeItemCodes를 100개씩 청크로 나눠 병렬 조회
    const chunks: string[][] = [];
    for (let i = 0; i < activeItemCodes.length; i += 100) {
      chunks.push(activeItemCodes.slice(i, i + 100));
    }

    const chunkResults = await Promise.all(chunks.map(async (chunk) => {
      const rows: Shipment[] = [];
      let from = 0;
      while (true) {
        const { data: page } = await supabase
          .from('shipments')
          .select('ship_date, quantity, item_no, client_name, manager, unit_price, selling_price, supply_amount, business_type')
          .in('item_no', chunk)
          .gte('ship_date', '2020-01-01')
          .lte('ship_date', analysisEnd)
          .range(from, from + 999);
        if (!page || page.length === 0) break;
        rows.push(...page);
        if (page.length < 1000) break;
        from += 1000;
      }
      return rows;
    }));
    for (const rows of chunkResults) allShipments.push(...rows);

    // ── 업종 목록 추출 + 거래처-업종 매핑 ──
    const businessTypeSet = new Set<string>();
    const clientBusinessType: Record<string, string> = {};
    for (const s of allShipments) {
      const bt = (s.business_type || '').trim() || '(미분류)';
      businessTypeSet.add(bt);
      if (s.client_name && !clientBusinessType[s.client_name]) clientBusinessType[s.client_name] = bt;
    }
    const allBusinessTypes = [...businessTypeSet].sort();

    // ── 업종 필터링 ──
    const excludeBT = new Set<string>(excludeBusinessTypes || []);
    let filteredShipments = excludeBT.size > 0
      ? allShipments.filter(s => {
          const bt = (s.business_type || '').trim() || '(미분류)';
          return !excludeBT.has(bt);
        })
      : allShipments;

    // ── 특판 제외: 1일 1거래처 1와인 bulkThreshold병 이상 (분석 기간 내만 대상) ──
    let bulkExcluded = { count: 0, qty: 0 };
    let bulkDetails: { date: string; client: string; wine: string; qty: number; manager: string }[] = [];
    if (excludeBulkSales) {
      const dayClientWine: Record<string, { total: number; indices: number[]; client: string; wine: string; date: string; manager: string }> = {};
      for (let i = 0; i < filteredShipments.length; i++) {
        const s = filteredShipments[i];
        // 분석 기간 밖 데이터는 특판 판정 대상에서 제외 (러닝커브용 과거 데이터 보존)
        if (s.ship_date < analysisStart || s.ship_date > analysisEnd) continue;
        const wineName = getWineName(s.item_no);
        const key = `${s.ship_date}|${s.client_name}|${wineName}`;
        if (!dayClientWine[key]) dayClientWine[key] = { total: 0, indices: [], client: s.client_name, wine: wineName, date: s.ship_date, manager: s.manager };
        dayClientWine[key].total += s.quantity || 0;
        dayClientWine[key].indices.push(i);
      }
      const bulkIndices = new Set<number>();
      for (const v of Object.values(dayClientWine)) {
        if (v.total >= bulkThreshold) {
          for (const idx of v.indices) bulkIndices.add(idx);
          bulkExcluded.count++;
          bulkExcluded.qty += v.total;
          bulkDetails.push({ date: v.date, client: v.client, wine: v.wine, qty: v.total, manager: v.manager });
        }
      }
      bulkDetails.sort((a, b) => b.date.localeCompare(a.date));
      if (bulkIndices.size > 0) {
        filteredShipments = filteredShipments.filter((_, i) => !bulkIndices.has(i));
      }
    }

    // ── 샘플 제외: 거래처별 1병만 출고 건 + 출고가 0원 건 ──
    let sampleExcluded = { count: 0, qty: 0 };
    if (excludeSamples) {
      const sampleIndices = new Set<number>();

      // 1) 출고가 0원인 건 제외 (무상 샘플)
      for (let i = 0; i < filteredShipments.length; i++) {
        const s = filteredShipments[i];
        if (s.ship_date < analysisStart || s.ship_date > analysisEnd) continue;
        const sell = s.selling_price || 0;
        const unit = s.unit_price || 0;
        if (sell === 0 && unit === 0 && (s.quantity || 0) > 0) {
          sampleIndices.add(i);
          sampleExcluded.count++;
          sampleExcluded.qty += s.quantity || 0;
        }
      }

      // 2) 거래처별 1병만 출고되고 재주문 없는 건
      const clientWineQty: Record<string, { total: number; indices: number[] }> = {};
      for (let i = 0; i < filteredShipments.length; i++) {
        if (sampleIndices.has(i)) continue; // 이미 0원으로 제외된 건 스킵
        const s = filteredShipments[i];
        if (s.ship_date < analysisStart || s.ship_date > analysisEnd) continue;
        const wineName = getWineName(s.item_no);
        const key = `${s.client_name}|${wineName}`;
        if (!clientWineQty[key]) clientWineQty[key] = { total: 0, indices: [] };
        clientWineQty[key].total += s.quantity || 0;
        clientWineQty[key].indices.push(i);
      }
      for (const v of Object.values(clientWineQty)) {
        if (v.total === 1) {
          for (const idx of v.indices) sampleIndices.add(idx);
          sampleExcluded.count++;
          sampleExcluded.qty += v.total;
        }
      }

      if (sampleIndices.size > 0) {
        filteredShipments = filteredShipments.filter((_, i) => !sampleIndices.has(i));
      }
    }

    // 트렌드는 별도 API(/api/forecast/trends)에서 전체 데이터 기준으로 계산

    // ── 3단계: 재고 소진 보정 ──
    const stockoutCorrections = noCorrection ? {} : calcStockoutCorrections(filteredShipments, getWineName);

    // ── 4단계: 러닝커브 (신규 품목일 때만, 보정제외 시 스킵) ──
    const learningCurve = (isNewItem && !noCorrection) ? calcLearningCurve(filteredShipments, getWineName) : null;

    // ── 4-1단계: 월별 판매 추이 (와인명 기준 그룹핑, 빈티지 통합) ──
    // 분석 기간 + 전년도 데이터도 수집 (YoY 비교용)
    const prevYearStart = `${Number(yearFrom) - 1}-01-01`;
    const monthlyData: Record<string, { qty: number; amount: number }> = {};
    const yearlyData: Record<string, { qty: number; amount: number }> = {};
    for (const s of filteredShipments) {
      if (s.ship_date < prevYearStart || s.ship_date > analysisEnd) continue;
      const qty = s.quantity || 0;
      if (qty <= 0) continue;
      const sp = s.selling_price || 0;
      const sa = s.supply_amount || 0;
      let amount: number;
      if (qty <= 1) amount = sp;
      else if (sa !== 0 && Math.abs(sp * qty - Math.abs(sa)) < 100) amount = Math.abs(sa);
      else amount = sp;
      const ym = s.ship_date.slice(0, 7);
      const yr = s.ship_date.slice(0, 4);
      if (!monthlyData[ym]) monthlyData[ym] = { qty: 0, amount: 0 };
      monthlyData[ym].qty += qty;
      monthlyData[ym].amount += amount;
      if (!yearlyData[yr]) yearlyData[yr] = { qty: 0, amount: 0 };
      yearlyData[yr].qty += qty;
      yearlyData[yr].amount += amount;
    }
    const monthlySeries = Object.entries(monthlyData).sort(([a], [b]) => a.localeCompare(b)).map(([month, d]) => ({ month, qty: d.qty, amount: d.amount }));
    const yearlySeries = Object.entries(yearlyData).sort(([a], [b]) => a.localeCompare(b)).map(([year, d]) => ({ year, qty: d.qty, amount: d.amount }));

    // ── 5단계: 영업사원별 분석 (보정 적용) ──
    const periodShipments = filteredShipments.filter(s => s.ship_date >= analysisStart && s.ship_date <= analysisEnd);
    const managerGroups: Record<string, Shipment[]> = {};
    for (const s of periodShipments) {
      if (!MANAGERS.includes(s.manager)) continue;
      if (!managerGroups[s.manager]) managerGroups[s.manager] = [];
      managerGroups[s.manager].push(s);
    }

    const results = [];

    for (const manager of MANAGERS) {
      const mShipments = managerGroups[manager] || [];
      if (mShipments.length === 0) continue;

      const yearMap: Record<string, { qty: number; correctedQty: number; wineNames: Set<string>; clients: Set<string> }> = {};
      const wineStats: Record<string, { qty: number; correctedQty: number; clients: Set<string>; years: Set<string>; codes: Set<string>; price: number; importCost: number; totalListAmt: number; totalListQty: number; totalUnitAmt: number; totalUnitQty: number }> = {};
      const clientStats: Record<string, { qty: number; wineNames: Set<string> }> = {};
      const channelStats: Record<string, { qty: number; correctedQty: number; clients: Set<string>; wineNames: Set<string> }> = {};

      for (const s of mShipments) {
        const yr = s.ship_date?.substring(0, 4);
        if (!yr) continue;
        const wineName = getWineName(s.item_no);
        const qty = s.quantity || 0;
        const factor = stockoutCorrections[wineName]?.factor || 1;
        const correctedQty = Math.round(qty * factor);

        if (!yearMap[yr]) yearMap[yr] = { qty: 0, correctedQty: 0, wineNames: new Set(), clients: new Set() };
        yearMap[yr].qty += qty;
        yearMap[yr].correctedQty += correctedQty;
        yearMap[yr].wineNames.add(wineName);
        yearMap[yr].clients.add(s.client_name);

        if (!wineStats[wineName]) wineStats[wineName] = { qty: 0, correctedQty: 0, clients: new Set(), years: new Set(), codes: new Set(), price: wineMap[s.item_no]?.price || 0, importCost: wineMap[s.item_no]?.importCost || 0, totalListAmt: 0, totalListQty: 0, totalUnitAmt: 0, totalUnitQty: 0 };
        wineStats[wineName].qty += qty;
        wineStats[wineName].correctedQty += correctedQty;
        wineStats[wineName].clients.add(s.client_name);
        wineStats[wineName].years.add(yr);
        wineStats[wineName].codes.add(s.item_no);
        if (qty > 0) {
          // 정상 공급가 (wines 테이블 기준, 빈티지별 다를 수 있음)
          const listPrice = wineMap[s.item_no]?.price || 0;
          if (listPrice > 0) {
            wineStats[wineName].totalListAmt += listPrice * qty;
            wineStats[wineName].totalListQty += qty;
          }
          // 실제 출고 공급가: selling_price(sp)와 supply_amount(sa)로 총액 판별 후 단가 산출
          const sp = s.selling_price || 0;
          const sa = s.supply_amount || 0;
          const unitP = s.unit_price || 0;
          let totalAmount: number;
          if (qty <= 1) {
            totalAmount = sp; // qty=1이면 단가=총액
          } else if (sa > 0 && Math.abs(sp * qty - Math.abs(sa)) < 100) {
            totalAmount = Math.abs(sa); // sp는 단가, sa가 총액
          } else {
            totalAmount = sp; // sp 자체가 총액
          }
          let perUnitPrice = qty > 0 ? Math.round(totalAmount / qty) : 0;
          // unit_price와 비교하여 더 낮은 값 사용 (할인 반영)
          if (unitP > 0 && perUnitPrice > 0) {
            perUnitPrice = Math.min(perUnitPrice, unitP);
          }
          if (perUnitPrice > 0 && (listPrice === 0 || perUnitPrice <= listPrice)) {
            wineStats[wineName].totalUnitAmt += perUnitPrice * qty;
            wineStats[wineName].totalUnitQty += qty;
          }
        }

        if (!clientStats[s.client_name]) clientStats[s.client_name] = { qty: 0, wineNames: new Set() };
        clientStats[s.client_name].qty += qty;
        clientStats[s.client_name].wineNames.add(wineName);

        // 채널별 집계
        const bt = (s.business_type || '').trim() || '(미분류)';
        if (!channelStats[bt]) channelStats[bt] = { qty: 0, correctedQty: 0, clients: new Set(), wineNames: new Set() };
        channelStats[bt].qty += qty;
        channelStats[bt].correctedQty += correctedQty;
        channelStats[bt].clients.add(s.client_name);
        channelStats[bt].wineNames.add(wineName);
      }

      const years = Object.entries(yearMap).filter(([, v]) => v.qty >= 6);
      if (years.length === 0) continue;

      const sortedYears = years.sort(([a], [b]) => a.localeCompare(b));
      const maxYr = Math.max(...sortedYears.map(([yr]) => Number(yr)));
      const getWeight = (yr: string) => {
        const diff = maxYr - Number(yr);
        return diff === 0 ? 3 : diff === 1 ? 2 : 1;
      };
      const totalWeight = sortedYears.reduce((s, [yr]) => s + getWeight(yr), 0);

      const avgQtyRaw = Math.round(sortedYears.reduce((s, [yr, v]) => s + v.qty * getWeight(yr), 0) / totalWeight);
      const avgQtyCorrected = Math.round(sortedYears.reduce((s, [yr, v]) => s + v.correctedQty * getWeight(yr), 0) / totalWeight);
      const avgWines = Math.round(sortedYears.reduce((s, [yr, v]) => s + v.wineNames.size * getWeight(yr), 0) / totalWeight);
      const avgClients = Math.round(sortedYears.reduce((s, [yr, v]) => s + v.clients.size * getWeight(yr), 0) / totalWeight);

      const divisor = isNewItem ? avgWines + 1 : avgWines;
      const qtyPerItemRaw = divisor > 0 ? Math.round(avgQtyRaw / divisor) : 0;
      const qtyPerItem = divisor > 0 ? Math.round(avgQtyCorrected / divisor) : 0;
      const qtyPerItemYear1 = learningCurve ? Math.round(qtyPerItem * learningCurve.ratio) : null;

      // 와인별 분포 통계 (유사 와인 성과 참조용)
      const perWineAnnuals = Object.values(wineStats)
        .map(v => Math.round(v.correctedQty / Math.max(v.years.size, 1)))
        .filter(v => v >= 6)
        .sort((a, b) => a - b);
      const median = perWineAnnuals.length > 0 ? perWineAnnuals[Math.floor(perWineAnnuals.length / 2)] : 0;
      const p25 = perWineAnnuals.length >= 4 ? perWineAnnuals[Math.floor(perWineAnnuals.length * 0.25)] : perWineAnnuals[0] || 0;
      const p75 = perWineAnnuals.length >= 4 ? perWineAnnuals[Math.floor(perWineAnnuals.length * 0.75)] : perWineAnnuals[perWineAnnuals.length - 1] || 0;

      const yearDetails = sortedYears.map(([yr]) => {
        const v = yearMap[yr];
        return {
          year: yr, qty: v.qty, correctedQty: v.correctedQty,
          items: v.wineNames.size, clients: v.clients.size,
          qtyPerItem: v.wineNames.size > 0 ? Math.round(v.qty / (isNewItem ? v.wineNames.size + 1 : v.wineNames.size)) : 0,
          qtyPerItemCorrected: v.wineNames.size > 0 ? Math.round(v.correctedQty / (isNewItem ? v.wineNames.size + 1 : v.wineNames.size)) : 0,
        };
      });

      const wineDetails = Object.entries(wineStats)
        .sort(([, a], [, b]) => b.qty - a.qty)
        .map(([name, v]) => ({
          item_code: [...v.codes].join(', '),
          item_name: name,
          supply_price: v.totalListQty > 0 ? Math.round(v.totalListAmt / v.totalListQty) : v.price,
          avg_import_cost: v.importCost,
          avg_selling_price: v.totalUnitQty > 0 ? Math.round(v.totalUnitAmt / v.totalUnitQty) : v.price,
          region: wineMap[[...v.codes][0]]?.region || null,
          total_qty: v.qty,
          corrected_qty: v.correctedQty,
          stockout_factor: Math.round((stockoutCorrections[name]?.factor || 1) * 100) / 100,
          client_count: v.clients.size,
          years_sold: v.years.size,
          annual_avg: Math.round(v.qty / v.years.size),
          annual_avg_corrected: Math.round(v.correctedQty / v.years.size),
        }));

      const topClients = Object.entries(clientStats)
        .sort(([, a], [, b]) => b.qty - a.qty)
        .slice(0, 10)
        .map(([name, v]) => ({
          client_name: name,
          total_qty: v.qty,
          item_count: v.wineNames.size,
          business_type: clientBusinessType[name] || '(미분류)',
        }));

      // 채널별 분석
      const yearsCount = Math.max(years.length, 1);
      const channels = Object.entries(channelStats)
        .map(([channel, v]) => ({
          channel,
          qty: v.correctedQty,
          annual_qty: Math.round(v.correctedQty / yearsCount),
          clients: v.clients.size,
          wines: v.wineNames.size,
          qty_per_wine: v.wineNames.size > 0 ? Math.round(v.correctedQty / yearsCount / (isNewItem ? v.wineNames.size + 1 : v.wineNames.size)) : 0,
          pct: 0,
        }))
        .filter(c => c.qty > 0)
        .sort((a, b) => b.qty - a.qty);
      const totalChQty = channels.reduce((s, c) => s + c.qty, 0);
      channels.forEach(c => { c.pct = totalChQty > 0 ? Math.round(c.qty / totalChQty * 100) : 0; });

      results.push({
        manager,
        years_active: years.length,
        avg_annual_qty: avgQtyRaw,
        avg_annual_qty_corrected: avgQtyCorrected,
        avg_items: avgWines,
        qty_per_item_raw: qtyPerItemRaw,
        qty_per_item: qtyPerItem,
        qty_per_item_year1: qtyPerItemYear1,
        avg_clients: avgClients,
        min_qty: Math.min(...years.map(([, v]) => v.qty)),
        max_qty: Math.max(...years.map(([, v]) => v.qty)),
        wine_distribution: { median, p25, p75, count: perWineAnnuals.length },
        channels,
        year_details: yearDetails,
        wine_details: wineDetails,
        top_clients: topClients,
      });
    }

    results.sort((a, b) => b.avg_annual_qty - a.avg_annual_qty);

    // 재고소진 보정 통계
    const correctedNames = Object.entries(stockoutCorrections).filter(([, v]) => v.factor > 1);
    const stockoutInfo = {
      correctedWines: correctedNames.length,
      totalWines: Object.keys(stockoutCorrections).length,
      avgFactor: correctedNames.length > 0
        ? Math.round(correctedNames.reduce((s, [, v]) => s + v.factor, 0) / correctedNames.length * 100) / 100
        : 1,
    };

    // 평균 공급가: 실제 출고된 판매가(selling_price) 기반, 판매량 가중 평균
    const wineByName: Record<string, { avgPrice: number; qty: number }> = {};
    for (const r of results) {
      for (const w of (r.wine_details || []) as { item_name: string; avg_selling_price: number; total_qty: number }[]) {
        if (w.avg_selling_price > 0 && w.total_qty > 0) {
          if (!wineByName[w.item_name]) wineByName[w.item_name] = { avgPrice: w.avg_selling_price, qty: 0 };
          wineByName[w.item_name].qty += w.total_qty;
        }
      }
    }
    const soldEntries = Object.values(wineByName);
    const totalSoldQty = soldEntries.reduce((s, e) => s + e.qty, 0);
    const avgSupplyPrice = totalSoldQty > 0 ? Math.round(soldEntries.reduce((s, e) => s + e.avgPrice * e.qty, 0) / totalSoldQty) : 0;
    const soldPriceList = soldEntries.map(e => e.avgPrice);
    const minSupplyPrice = soldPriceList.length > 0 ? Math.min(...soldPriceList) : 0;
    const maxSupplyPrice = soldPriceList.length > 0 ? Math.max(...soldPriceList) : 0;

    return NextResponse.json({
      stats: results,
      priceRange,
      matchedItems: activeItemCodes.length,
      allMatchedItems: allMatchedCount,
      excludedWines: excludedWineList,
      stockoutInfo,
      bulkInfo: excludeBulkSales ? { excluded: bulkExcluded.count, qty: bulkExcluded.qty, threshold: bulkThreshold, details: bulkDetails } : null,
      sampleInfo: excludeSamples ? { excluded: sampleExcluded.count, qty: sampleExcluded.qty } : null,
      priceStats: { avg: avgSupplyPrice, min: minSupplyPrice, max: maxSupplyPrice },
      businessTypes: allBusinessTypes,
      learningCurve: learningCurve ? { ratio: learningCurve.ratio, sampleSize: learningCurve.sampleSize, details: learningCurve.details.slice(0, 5) } : null,
      monthlySeries,
      yearlySeries,
    });
  } catch (err) {
    console.error('Forecast error:', err);
    return NextResponse.json({ error: 'Server error', detail: String(err) }, { status: 500 });
  }
}

// ── 재고 소진 보정 계산 ──
// 와인명 기준 월별 출고 패턴에서 2개월+ 공백 후 재개된 구간을 품절로 판정
function calcStockoutCorrections(
  shipments: { ship_date: string; quantity: number; item_no: string }[],
  getWineName: (itemNo: string) => string,
): Record<string, { factor: number; activeMonths: number; totalMonths: number; stockoutMonths: number }> {
  const wineMonthly: Record<string, Record<string, number>> = {};

  for (const s of shipments) {
    const ym = s.ship_date?.substring(0, 7);
    if (!ym || (s.quantity || 0) <= 0) continue;
    const name = getWineName(s.item_no);
    if (!wineMonthly[name]) wineMonthly[name] = {};
    wineMonthly[name][ym] = (wineMonthly[name][ym] || 0) + s.quantity;
  }

  const result: Record<string, { factor: number; activeMonths: number; totalMonths: number; stockoutMonths: number }> = {};

  for (const [name, monthly] of Object.entries(wineMonthly)) {
    const months = Object.keys(monthly).sort();
    if (months.length < 3) {
      result[name] = { factor: 1, activeMonths: months.length, totalMonths: months.length, stockoutMonths: 0 };
      continue;
    }

    const first = months[0];
    const last = months[months.length - 1];
    const [fy, fm] = first.split('-').map(Number);
    const [ly, lm] = last.split('-').map(Number);
    const totalMonths = (ly - fy) * 12 + (lm - fm) + 1;
    const activeMonths = months.length;

    if (totalMonths - activeMonths < 2 || totalMonths < 6) {
      result[name] = { factor: 1, activeMonths, totalMonths, stockoutMonths: 0 };
      continue;
    }

    // 공백 전후 판매 존재 확인 → 재고 소진 판정
    // 최소 2개월 연속 판매 후에야 "본격 판매"로 인정 (샘플/빈티지 전환 대기 제외)
    const monthSet = new Set(months);
    let stockoutMonths = 0;
    let consecutiveGap = 0;
    let consecutiveSales = 0;
    let hadSustainedSales = false;
    const current = new Date(fy, fm - 1);
    const lastDate = new Date(ly, lm - 1);

    while (current <= lastDate) {
      const ym = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
      if (monthSet.has(ym)) {
        if (consecutiveGap >= 2 && hadSustainedSales) {
          stockoutMonths += consecutiveGap;
        }
        consecutiveGap = 0;
        consecutiveSales++;
        if (consecutiveSales >= 2) hadSustainedSales = true;
      } else {
        consecutiveGap++;
        consecutiveSales = 0;
      }
      current.setMonth(current.getMonth() + 1);
    }

    if (stockoutMonths === 0) {
      result[name] = { factor: 1, activeMonths, totalMonths, stockoutMonths: 0 };
      continue;
    }

    const effectiveMonths = totalMonths - stockoutMonths;
    const rawFactor = totalMonths / effectiveMonths;
    const factor = Math.min(Math.round(rawFactor * 100) / 100, 2.0);

    result[name] = { factor, activeMonths, totalMonths, stockoutMonths };
  }

  return result;
}

// ── 러닝커브 계산 ──
// 24개월+ 이력이 있는 와인의 1년차 vs 2년차+ 판매 비율
function calcLearningCurve(
  shipments: { ship_date: string; quantity: number; item_no: string }[],
  getWineName: (itemNo: string) => string,
): { ratio: number; sampleSize: number; details: { name: string; year1: number; mature: number; ratio: number }[] } {
  const wineShips: Record<string, { date: string; qty: number }[]> = {};

  for (const s of shipments) {
    if (!s.ship_date || (s.quantity || 0) <= 0) continue;
    const name = getWineName(s.item_no);
    if (!wineShips[name]) wineShips[name] = [];
    wineShips[name].push({ date: s.ship_date, qty: s.quantity });
  }

  const details: { name: string; year1: number; mature: number; ratio: number }[] = [];

  for (const [name, ships] of Object.entries(wineShips)) {
    ships.sort((a, b) => a.date.localeCompare(b.date));
    const firstDate = new Date(ships[0].date);
    const lastDate = new Date(ships[ships.length - 1].date);

    const monthsSpan = (lastDate.getFullYear() - firstDate.getFullYear()) * 12 +
      (lastDate.getMonth() - firstDate.getMonth());
    if (monthsSpan < 23) continue;

    // 1년차 경계
    const year1End = new Date(firstDate);
    year1End.setFullYear(year1End.getFullYear() + 1);
    const year1EndStr = year1End.toISOString().substring(0, 10);

    let year1Qty = 0;
    let matureQty = 0;
    for (const s of ships) {
      if (s.date < year1EndStr) year1Qty += s.qty;
      else matureQty += s.qty;
    }

    // 2년차+ 기간 (월 단위)
    const matureMonths = (lastDate.getFullYear() - year1End.getFullYear()) * 12 +
      (lastDate.getMonth() - year1End.getMonth()) + 1;
    if (matureMonths < 12) continue;

    const matureAnnual = Math.round(matureQty / matureMonths * 12);
    if (matureAnnual < 12) continue;

    // 프로모션 론칭 등 1년차 > 2년차+인 경우 제외
    if (year1Qty > matureAnnual * 1.2) continue;

    const ratio = Math.round(year1Qty / matureAnnual * 100) / 100;
    if (ratio > 0 && ratio <= 1.0) {
      details.push({ name, year1: year1Qty, mature: matureAnnual, ratio });
    }
  }

  if (details.length === 0) {
    return { ratio: 0.7, sampleSize: 0, details: [] };
  }

  const avgRatio = Math.round(details.reduce((s, d) => s + d.ratio, 0) / details.length * 100) / 100;

  return {
    ratio: avgRatio,
    sampleSize: details.length,
    details: details.sort((a, b) => a.ratio - b.ratio),
  };
}

function getPriceRange(price: number) {
  if (price < 10000) return { label: '~1만', min: 0, max: 10000 };
  if (price < 20000) return { label: '1~2만', min: 10000, max: 20000 };
  if (price < 30000) return { label: '2~3만', min: 20000, max: 30000 };
  if (price < 50000) return { label: '3~5만', min: 30000, max: 50000 };
  if (price < 100000) return { label: '5~10만', min: 50000, max: 100000 };
  return { label: '10만~', min: 100000, max: 999999999 };
}
