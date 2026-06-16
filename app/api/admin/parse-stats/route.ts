// app/api/admin/parse-stats/route.ts
// order-v2 발주 파싱 에스컬레이션 비율·비용 집계 (fn_parse_stats RPC)
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/db";
import { handleApiError } from "@/app/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const raw = Number(req.nextUrl.searchParams.get("days"));
    const days = Math.min(365, Math.max(1, Number.isFinite(raw) && raw > 0 ? raw : 30));
    const { data, error } = await supabase.rpc("fn_parse_stats", { p_days: days });
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, stats: data });
  } catch (e) {
    return handleApiError(e);
  }
}
