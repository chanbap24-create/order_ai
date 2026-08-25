import { supabase } from '@/app/lib/db';
import { fetchAllRows } from '@/app/lib/fetchAll';
import { NextResponse } from 'next/server';

import { BRAND_COUNTRY, WINE_CODES } from './lib/constants';
import { getPriceRange } from './lib/priceRange';
import { buildVintageMap, resolveWine, type ResolvedWine } from './lib/wineResolver';
import { fetchShipments, fetchPastShipments } from './lib/shipmentFetcher';
import { expandRegionKeywords } from './lib/regionExpander';
import { calcStockoutCorrections } from './lib/stockoutCorrection';
import { calcLearningCurve } from './lib/learningCurve';
import { analyzeManagers } from './lib/managerAnalysis';
import { applyBulkFilter, applySampleFilter, buildMonthlyYearlySeries } from './lib/filters';
import type { Shipment, WineRow, WineMapEntry } from './lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      country, regionSearch, wineType, brand,
      supplyPrice, priceMin, priceMax,
      startYear, endYear,
      isNewItem, excludeWineNames,
      excludeBulkSales, bulkThreshold: rawBulkThreshold,
      excludeSamples, noCorrection, excludeBusinessTypes,
    } = body;
    const bulkThreshold = Number(rawBulkThreshold) || 60;

    if (!country && !brand) {
      return NextResponse.json({ error: '국가 또는 브랜드를 선택해주세요' }, { status: 400 });
    }

    // 공급가 범위 결정 (미입력 시 전체)
    let pMin: number, pMax: number, priceLabel: string;
    if (priceMin !== undefined && priceMax !== undefined && (Number(priceMin) > 0 || Number(priceMax) < 999999999)) {
      pMin = Number(priceMin) || 0;
      pMax = Number(priceMax) || 999999999;
      priceLabel = `${pMin.toLocaleString()}~${pMax.toLocaleString()}원`;
    } else if (supplyPrice) {
      const range = getPriceRange(supplyPrice);
      pMin = range.min; pMax = range.max; priceLabel = range.label;
    } else {
      pMin = 0; pMax = 999999999; priceLabel = '전체 가격';
    }

    const priceRange = { label: priceLabel, min: pMin, max: pMax };
    const yearFrom = startYear || 2022;
    const yearTo = endYear || new Date().getFullYear();
    const analysisStart = `${yearFrom}-01-01`;
    const analysisEnd = `${yearTo}-12-31`;

    // ── 1단계: wines + inventory_cdv 전체 로드 (4-stage 매칭용) — 1000행 캡 페이지네이션 ──
    const [allWines, inv] = await Promise.all([
      fetchAllRows<WineRow>((f, t) => supabase.from('wines')
        .select('item_code, item_name_kr, supply_price, avg_import_cost, region, grape_varieties, wine_type, country, supplier_kr')
        .not('item_code', 'like', 'D%').order('item_code').range(f, t)),
      fetchAllRows<{ item_no: string; country: string | null }>((f, t) =>
        supabase.from('inventory_cdv').select('item_no, country').order('item_no').range(f, t)),
    ]);

    const wineMapForResolve = new Map<string, WineRow>();
    for (const w of (allWines || []) as WineRow[]) wineMapForResolve.set(w.item_code, w);

    const invMap = new Map<string, string>();
    for (const r of (inv || []) as Array<{ item_no: string; country: string | null }>) {
      if (r.country) invMap.set(r.item_no, r.country);
    }

    const brandCountry = new Map<string, string>();
    for (const w of (allWines || []) as WineRow[]) {
      const m = (w.item_name_kr || '').match(/^([A-Z]{2})\s/);
      if (m && w.country) brandCountry.set(m[1], w.country);
    }
    for (const [k, v] of Object.entries(BRAND_COUNTRY)) {
      if (!brandCountry.has(k)) brandCountry.set(k, v);
    }

    const vintageMap = buildVintageMap(wineMapForResolve);
    const resolveCache = new Map<string, ResolvedWine>();

    // 지역 검색 키워드 확장
    let regionKeywords: string[] | null = null;
    if (regionSearch) {
      regionKeywords = await expandRegionKeywords(regionSearch, country, !!body.isSubRegion);
    }

    // ── 2단계: 출고 데이터 조회 (2단계 전략) ──
    const prevYearStart = `${Math.max(Number(yearFrom) - 1, 2020)}-01-01`;

    const periodShipmentsRaw = await fetchShipments(prevYearStart, analysisEnd);
    const allShipments: Shipment[] = [...periodShipmentsRaw];

    // ── 3단계: 4-stage 매칭 + 필터링으로 대상 출고 건 선별 ──
    const wineMap: Record<string, WineMapEntry> = {};
    const matchedItemCodes = new Set<string>();
    const filteredShipmentIndices = new Set<number>();

    for (let idx = 0; idx < allShipments.length; idx++) {
      const s = allShipments[idx];
      if (!s.item_no || s.item_no.length < 5) continue;
      const firstChar = s.item_no.charAt(0).toUpperCase();
      if (!WINE_CODES.has(firstChar)) continue;

      let resolved = resolveCache.get(s.item_no);
      if (!resolved) {
        resolved = resolveWine(s.item_no, s.item_name || '', wineMapForResolve, invMap, brandCountry, vintageMap);
        resolveCache.set(s.item_no, resolved);
      }
      const { country: rCountry, region: rRegion, wineType: rType, wineData, brandCode: rBrand } = resolved;

      if (country && rCountry !== country) continue;
      if (brand && rBrand !== brand) continue;
      if (wineType && rType !== wineType) continue;
      if (regionKeywords && regionKeywords.length > 0) {
        if (!rRegion) continue;
        const rLower = rRegion.toLowerCase();
        const matched = regionKeywords.some(kw => rLower.includes(kw.toLowerCase()));
        if (!matched) continue;
      }
      if (pMin > 0 || pMax < 999999999) {
        const sp = wineData?.supply_price;
        if (sp && sp > 0 && (sp < pMin || sp >= pMax)) continue;
      }

      filteredShipmentIndices.add(idx);
      matchedItemCodes.add(s.item_no);

      if (!wineMap[s.item_no]) {
        if (wineData) {
          wineMap[s.item_no] = {
            name: wineData.item_name_kr || s.item_name || s.item_no,
            price: wineData.supply_price || 0,
            importCost: wineData.avg_import_cost || 0,
            region: wineData.region || rRegion,
            grape: wineData.grape_varieties || null,
            type: wineData.wine_type || rType,
            country: wineData.country || rCountry,
            brand: wineData.supplier_kr || null,
          };
        } else {
          wineMap[s.item_no] = {
            name: s.item_name || s.item_no,
            price: 0, importCost: 0,
            region: rRegion, grape: null, type: rType, country: rCountry, brand: null,
          };
        }
      }
    }

    const activeItemCodes = [...matchedItemCodes];
    const allMatchedCount = activeItemCodes.length;

    if (activeItemCodes.length > 0 && prevYearStart > '2020-01-01') {
      const pastRows = await fetchPastShipments(activeItemCodes, prevYearStart);
      for (const r of pastRows) allShipments.push(r);
    }

    if (allMatchedCount === 0) {
      const msg = regionSearch
        ? `해당 지역의 와인 출고 이력이 없습니다. 지역을 '전체'로 변경해 보세요.`
        : `해당 조건의 와인 출고 이력이 없습니다 (${country || brand}, ${priceRange.label}).`;
      return NextResponse.json({ stats: [], priceRange, matchedItems: 0, message: msg });
    }

    const getWineName = (itemNo: string) => wineMap[itemNo]?.name || itemNo;

    // 제외 와인 필터링
    const excludeSet = new Set<string>(excludeWineNames || []);
    const excludedCodes = new Set<string>();
    if (excludeSet.size > 0) {
      for (const code of activeItemCodes) {
        if (excludeSet.has(wineMap[code]?.name)) excludedCodes.add(code);
      }
    }

    const excludedWineList = excludeSet.size > 0
      ? activeItemCodes.filter(code => excludedCodes.has(code))
          .reduce((acc, code) => {
            const name = wineMap[code]?.name;
            if (name && !acc.find(w => w.item_name === name)) {
              acc.push({ item_name: name, supply_price: wineMap[code]?.price || 0, region: wineMap[code]?.region || null });
            }
            return acc;
          }, [] as { item_name: string; supply_price: number; region: string | null }[])
      : [];

    let filteredShipments = allShipments.filter((s, idx) => {
      if (excludedCodes.has(s.item_no)) return false;
      if (filteredShipmentIndices.has(idx)) return true;
      if (matchedItemCodes.has(s.item_no)) return true;
      return false;
    });

    const activeCount = activeItemCodes.length - excludedCodes.size;
    if (activeCount === 0) {
      return NextResponse.json({
        stats: [], priceRange, matchedItems: 0, allMatchedItems: allMatchedCount,
        excludedWines: excludedWineList, message: '모든 와인이 제외되었습니다.',
      });
    }

    // ── 업종 추출 + 필터링 ──
    const businessTypeSet = new Set<string>();
    const clientBusinessType: Record<string, string> = {};
    for (const s of filteredShipments) {
      const bt = (s.business_type || '').trim() || '(미분류)';
      businessTypeSet.add(bt);
      if (s.client_name && !clientBusinessType[s.client_name]) clientBusinessType[s.client_name] = bt;
    }
    const allBusinessTypes = [...businessTypeSet].sort();

    const excludeBT = new Set<string>(excludeBusinessTypes || []);
    if (excludeBT.size > 0) {
      filteredShipments = filteredShipments.filter(s => {
        const bt = (s.business_type || '').trim() || '(미분류)';
        return !excludeBT.has(bt);
      });
    }

    // ── 특판 제외: 1일 1거래처 1와인 bulkThreshold병 이상 (분석 기간 내만 대상) ──
    let bulkInfo = { count: 0, qty: 0, details: [] as { date: string; client: string; wine: string; qty: number; manager: string }[] };
    if (excludeBulkSales) {
      const res = applyBulkFilter(filteredShipments, analysisStart, analysisEnd, bulkThreshold, getWineName);
      filteredShipments = res.shipments;
      bulkInfo = res.info;
    }

    // ── 샘플 제외 ──
    let sampleInfo = { count: 0, qty: 0 };
    if (excludeSamples) {
      const res = applySampleFilter(filteredShipments, analysisStart, analysisEnd, getWineName);
      filteredShipments = res.shipments;
      sampleInfo = res.info;
    }

    // ── 재고 소진 보정 ──
    const stockoutCorrections = noCorrection ? {} : calcStockoutCorrections(filteredShipments, getWineName);

    // ── 러닝커브 (신규 품목일 때만, 보정제외 시 스킵) ──
    const learningCurve = (isNewItem && !noCorrection) ? calcLearningCurve(filteredShipments, getWineName) : null;

    // ── 월별/연도별 판매 추이 ──
    const { monthlySeries, yearlySeries } = buildMonthlyYearlySeries(filteredShipments, prevYearStart, analysisEnd);

    // ── 영업사원별 분석 (보정 적용) ──
    const periodShipments = filteredShipments.filter(s => s.ship_date >= analysisStart && s.ship_date <= analysisEnd);
    const results = analyzeManagers(
      periodShipments, wineMap, getWineName,
      stockoutCorrections, learningCurve, isNewItem,
      clientBusinessType,
    );

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
      for (const w of r.wine_details || []) {
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
      matchedItems: activeCount,
      allMatchedItems: allMatchedCount,
      excludedWines: excludedWineList,
      stockoutInfo,
      bulkInfo: excludeBulkSales ? { excluded: bulkInfo.count, qty: bulkInfo.qty, threshold: bulkThreshold, details: bulkInfo.details } : null,
      sampleInfo: excludeSamples ? { excluded: sampleInfo.count, qty: sampleInfo.qty } : null,
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
