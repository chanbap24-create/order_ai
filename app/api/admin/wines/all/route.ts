// GET /api/admin/wines/all - 전체 와인 목록 (RPC 1회 호출)
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

    // 가격대별 최소 가용재고 필터(JSON) — 정수만 추려 RPC에 전달(없으면 null=무필터)
    let minStock: Record<string, number> | null = null;
    const rawMin = url.searchParams.get("minStock");
    if (rawMin) {
      try {
        const o = JSON.parse(rawMin) as Record<string, unknown>;
        const pick: Record<string, number> = {};
        for (const k of ["u20k", "u50k", "u100k", "u200k", "over"]) {
          const v = Math.round(Number(o[k]));
          if (Number.isFinite(v) && v > 0) pick[k] = v;
        }
        if (Object.keys(pick).length) minStock = pick;
      } catch { /* ignore */ }
    }

    const { data, error } = await supabase.rpc("fn_wines_list", {
      p_search: search,
      p_country: country,
      p_status: statusFilter,
      p_hide_zero: hideZero,
      p_sort_by: sortBy,
      p_sort_dir: sortDir,
      p_page: page,
      p_limit: limit,
      p_min_stock: minStock,
    });

    if (error) throw new Error(error.message);

    const wines = (data.wines || []).map((w: Record<string, unknown>) => ({
      ...w,
      tasting_notes: undefined,
    }));
    const total = data.total || 0;

    return NextResponse.json({
      success: true,
      data: wines,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      countries: data.countries || [],
    });
  } catch (e) {
    return handleApiError(e);
  }
}
