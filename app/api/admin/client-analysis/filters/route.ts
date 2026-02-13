// app/api/admin/client-analysis/filters/route.ts
// 담당자/부서/업종구분 distinct 목록 + 날짜 범위 반환
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/db";
import { handleApiError } from "@/app/lib/errors";

/** 특정 컬럼의 모든 distinct 값을 페이지네이션으로 수집 */
async function getDistinctValues(table: string, column: string): Promise<string[]> {
  const PAGE_SIZE = 1000;
  const allValues = new Set<string>();
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(table)
      .select(column)
      .not(column, "is", null)
      .not(column, "eq", "")
      .range(offset, offset + PAGE_SIZE - 1);

    if (error || !data || data.length === 0) {
      hasMore = false;
      break;
    }

    for (const row of data) {
      allValues.add(row[column]);
    }

    if (data.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      offset += PAGE_SIZE;
    }
  }

  return [...allValues].sort();
}

export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get("type") || "wine";
    const table = type === "glass" ? "glass_shipments" : "shipments";

    // 병렬로 모든 distinct 값 + 날짜 범위 조회
    const [managers, departments, businessTypes, minRow, maxRow] = await Promise.all([
      getDistinctValues(table, "manager"),
      getDistinctValues(table, "department"),
      getDistinctValues(table, "business_type"),
      supabase
        .from(table)
        .select("ship_date")
        .not("ship_date", "is", null)
        .order("ship_date", { ascending: true })
        .limit(1),
      supabase
        .from(table)
        .select("ship_date")
        .not("ship_date", "is", null)
        .order("ship_date", { ascending: false })
        .limit(1),
    ]);

    const minDate = minRow.data?.[0]?.ship_date || null;
    const maxDate = maxRow.data?.[0]?.ship_date || null;

    return NextResponse.json({
      success: true,
      managers,
      departments,
      businessTypes,
      dateRange: { min: minDate, max: maxDate },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
