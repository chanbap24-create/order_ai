// GET /api/admin/wines/all - 전체 와인 목록 (페이지네이션, 검색, 필터)
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/db";
import { ensureWineTables } from "@/app/lib/wineDb";
import { handleApiError } from "@/app/lib/errors";

export async function GET(request: NextRequest) {
  try {
    ensureWineTables();
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const country = url.searchParams.get("country") || "";
    const statusFilter = url.searchParams.get("statusFilter") || "";
    const sortBy = url.searchParams.get("sortBy") || "";
    const sortDir = url.searchParams.get("sortDir") || "desc";
    const hideZero = url.searchParams.get("hideZero") === "1";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(200, Math.max(10, parseInt(url.searchParams.get("limit") || "50", 10)));
    const offset = (page - 1) * limit;

    // ── 국가 목록 (필터용) ──
    // Supabase doesn't support COALESCE in select directly, so fetch all and aggregate in JS
    const { data: countryData } = await supabase
      .from('wines')
      .select('country, country_en');

    const countryMap = new Map<string, number>();
    for (const row of (countryData || [])) {
      const name = row.country_en || row.country || '';
      if (name) {
        countryMap.set(name, (countryMap.get(name) || 0) + 1);
      }
    }
    const countries = Array.from(countryMap.entries())
      .map(([name, cnt]) => ({ name, cnt }))
      .sort((a, b) => b.cnt - a.cnt);

    // ── 데이터 쿼리 구성 ──
    let query = supabase
      .from('wines')
      .select('*, tasting_notes(id, ai_generated, approved)', { count: 'exact' });

    if (search) {
      const term = `%${search}%`;
      query = query.or(
        `item_code.ilike.${term},item_name_kr.ilike.${term},item_name_en.ilike.${term},country.ilike.${term},country_en.ilike.${term}`
      );
    }
    if (country) {
      query = query.or(`country.eq.${country},country_en.eq.${country}`);
    }
    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    // ── 커스텀 국가 정렬 순서 ──
    const COUNTRY_ORDER: Record<string, number> = {
      'England': 0, '영국': 0,
      'France': 1, '프랑스': 1,
      'Italy': 2, '이탈리아': 2, '이태리': 2,
      'Spain': 3, '스페인': 3,
      'Portugal': 4, '포르투갈': 4,
      'USA': 5, '미국': 5,
      'Chile': 6, '칠레': 6,
      'Argentina': 7, '아르헨티나': 7,
      'Australia': 8, '호주': 8,
      'NewZealand': 9, 'New Zealand': 9, '뉴질랜드': 9,
    };
    const getCountryOrder = (w: any) => {
      const c = w.country_en || w.country || '';
      return COUNTRY_ORDER[c] ?? 99;
    };

    // ── 커스텀 브랜드 정렬 순서 (가격리스트 원본 순서) ──
    const BRAND_ORDER: Record<string, number> = {
      RF:0,CH:1,SU:2,LG:3,CP:4,HG:5,MA:6,WM:7,VA:8,DA:9,
      LR:10,BL:11,DD:12,VG:13,RB:14,MG:15,CC:16,LM:17,CL:18,JP:19,
      DF:20,CD:21,GA:22,DP:23,CF:24,MD:25,CA:26,PE:27,BO:28,AS:29,
      EF:30,VP:31,OR:32,BS:33,AT:34,IG:35,MM:36,JC:37,SM:38,ST:39,
      CO:40,GH:41,BM:42,LS:43,FP:44,AR:45,LT:46,FL:47,PS:48,RG:49,
      RE:50,RT:51,SV:52,CR:53,RL:54,PF:55,GC:56,GF:57,MB:58,AD:59,
      PR:60,AC:61,LB:62,SS:63,HP:64,EM:65,CK:66,RO:67,LC:68,
    };
    const getBrandOrder = (w: any) => {
      const b = (w.brand || '').toUpperCase();
      return BRAND_ORDER[b] ?? 999;
    };

    // 정렬
    const SORTABLE = ['item_code', 'country_en', 'region', 'brand', 'item_name_kr', 'item_name_en', 'supply_price', 'available_stock'];
    const useCustomSort = !sortBy || !SORTABLE.includes(sortBy);

    let winesRaw: any[] = [];
    let totalCount: number | null = 0;

    if (!useCustomSort) {
      query = query.order(sortBy, { ascending: sortDir === 'asc', nullsFirst: false });
      query = query.range(offset, offset + limit - 1);
      const { data, count, error } = await query;
      if (error) throw error;
      winesRaw = data || [];
      totalCount = count;
    } else {
      // 커스텀 정렬: 전체 데이터를 배치로 가져옴
      const { count, error: countErr } = await supabase
        .from('wines')
        .select('*', { count: 'exact', head: true });
      if (countErr) throw countErr;
      totalCount = count;

      const PAGE_SIZE = 1000;
      const totalRows = count || 0;
      for (let off = 0; off < totalRows; off += PAGE_SIZE) {
        let batchQ = supabase
          .from('wines')
          .select('*, tasting_notes(id, ai_generated, approved)');
        if (search) {
          const term = `%${search}%`;
          batchQ = batchQ.or(
            `item_code.ilike.${term},item_name_kr.ilike.${term},item_name_en.ilike.${term},country.ilike.${term},country_en.ilike.${term}`
          );
        }
        if (country) batchQ = batchQ.or(`country.eq.${country},country_en.eq.${country}`);
        if (statusFilter) batchQ = batchQ.eq('status', statusFilter);
        batchQ = batchQ.range(off, off + PAGE_SIZE - 1);
        const { data: batchData } = await batchQ;
        winesRaw.push(...(batchData || []));
      }
    }

    // ── inventory_cdv에서 보세 수량 조회 ──
    const allCodes = (winesRaw || []).map((w: any) => w.item_code as string);
    const bondedMap = new Map<string, number>();
    // 배치로 조회 (1000개씩)
    for (let i = 0; i < allCodes.length; i += 1000) {
      const batch = allCodes.slice(i, i + 1000);
      const { data: invRows } = await supabase
        .from('inventory_cdv')
        .select('item_no, bonded_warehouse')
        .in('item_no', batch);
      for (const r of (invRows || [])) {
        bondedMap.set(r.item_no, r.bonded_warehouse || 0);
      }
    }

    // ── 결과 변환 (tasting_notes 임베드 → 플랫화) ──
    let wines = (winesRaw || []).map((w: any) => {
      const tn = w.tasting_notes?.[0];
      return {
        ...w,
        tasting_note_id: tn?.id ?? null,
        ai_generated: tn?.ai_generated ?? null,
        approved: tn?.approved ?? null,
        bonded_stock: bondedMap.get(w.item_code) ?? null,
        tasting_notes: undefined,
      };
    });

    // 재고+보세 0 이하 필터
    if (hideZero) {
      wines = wines.filter((w: any) => {
        const stock = (w.available_stock || 0) + (w.bonded_stock || 0);
        return stock > 0;
      });
    }

    const total = hideZero ? wines.length : (totalCount || wines.length);

    // 커스텀 정렬: 국가순서 → 브랜드(가격리스트순) → 가격 내림차순
    if (useCustomSort) {
      wines.sort((a: any, b: any) => {
        const co = getCountryOrder(a) - getCountryOrder(b);
        if (co !== 0) return co;
        const br = getBrandOrder(a) - getBrandOrder(b);
        if (br !== 0) return br;
        return (b.supply_price || 0) - (a.supply_price || 0);
      });
      wines = wines.slice(offset, offset + limit);
    }

    return NextResponse.json({
      success: true,
      data: wines,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      countries,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
