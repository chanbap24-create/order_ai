// 지역(시도/구)별 매출 — fn_region_sales RPC 집계 반환. 매출분석 탭 '지역별 매출' 카드용.
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/db";
import { handleApiError } from "@/app/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const type = sp.get("type") === "glass" ? "glass" : "wine";
    const start = sp.get("startDate") || "";
    const end = sp.get("endDate") || "";
    if (!start || !end) {
      return NextResponse.json({ success: false, error: "기간이 필요합니다." }, { status: 400 });
    }
    const { data, error } = await supabase.rpc("fn_region_sales", { p_type: type, p_start: start, p_end: end });
    if (error) throw error;
    return NextResponse.json({ success: true, rows: data || [] });
  } catch (e) {
    return handleApiError(e);
  }
}
