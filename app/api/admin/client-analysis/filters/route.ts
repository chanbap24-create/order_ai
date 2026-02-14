// app/api/admin/client-analysis/filters/route.ts
// 담당자/부서/업종구분 distinct 목록 + 날짜 범위 반환 (RPC 1회 호출)
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/db";
import { handleApiError } from "@/app/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get("type") || "wine";

    const { data, error } = await supabase.rpc("fn_shipment_filters", {
      p_type: type === "glass" ? "glass" : "wine",
    });

    if (error) throw new Error(error.message);

    return NextResponse.json({
      success: true,
      managers: data.managers || [],
      departments: data.departments || [],
      businessTypes: data.businessTypes || [],
      dateRange: data.dateRange || { min: null, max: null },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
