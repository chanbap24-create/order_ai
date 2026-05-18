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

    // "(미분류)" 옵션을 맨 앞에 추가 — 2025-08 이전 shipments에는
    // department가 NULL/빈값인 row가 30-50% 존재. 사용자가 이를 명시적으로 볼 수 있게.
    // fn_client_analysis가 p_department='(미분류)'를 받으면 NULL/'' row만 필터한다.
    const rawDepartments: string[] = data.departments || [];
    const departments = ['(미분류)', ...rawDepartments.filter((d: string) => d && d !== '(미분류)')];

    return NextResponse.json({
      success: true,
      managers: data.managers || [],
      departments,
      businessTypes: data.businessTypes || [],
      dateRange: data.dateRange || { min: null, max: null },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
