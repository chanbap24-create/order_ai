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
    const statusFilter = url.searchParams.get("statusFilter") || ""; // new, active, discontinued
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

    query = query
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: winesRaw, count: totalCount, error } = await query;

    if (error) throw error;

    // ── 결과 변환 (tasting_notes 임베드 → 플랫화) ──
    const wines = (winesRaw || []).map((w: any) => {
      const tn = w.tasting_notes?.[0];
      return {
        ...w,
        tasting_note_id: tn?.id ?? null,
        ai_generated: tn?.ai_generated ?? null,
        approved: tn?.approved ?? null,
        tasting_notes: undefined,
      };
    });

    const total = totalCount || 0;

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
