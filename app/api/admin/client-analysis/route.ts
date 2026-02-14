// app/api/admin/client-analysis/route.ts
// 거래처 분석 API — Postgres RPC로 DB에서 집계 (1~2회 호출)
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/db";
import { handleApiError } from "@/app/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const type = sp.get("type") || "wine";
    const clientCode = sp.get("clientCode") || "";
    const manager = sp.get("manager") || "";
    const department = sp.get("department") || "";
    const businessType = sp.get("businessType") || "";
    const clientSearch = sp.get("clientSearch") || "";
    const startDate = sp.get("startDate") || "";
    const endDate = sp.get("endDate") || "";

    const pType = type === "glass" ? "glass" : "wine";

    // 거래처 상세 조회 모드
    if (clientCode) {
      const { data, error } = await supabase.rpc("fn_client_detail", {
        p_type: pType,
        p_client_code: clientCode,
        p_start_date: startDate,
        p_end_date: endDate,
      });

      if (error) throw new Error(error.message);

      return NextResponse.json({
        success: true,
        clientItems: data.clientItems || [],
      });
    }

    // 전체 분석 모드 — fn_client_analysis + fn_manager_brands 병렬 호출
    const [analysisRes, brandsRes] = await Promise.all([
      supabase.rpc("fn_client_analysis", {
        p_type: pType,
        p_manager: manager,
        p_department: department,
        p_business_type: businessType,
        p_start_date: startDate,
        p_end_date: endDate,
        p_client_search: clientSearch,
      }),
      supabase.rpc("fn_manager_brands", {
        p_type: pType,
        p_manager: manager,
        p_department: department,
        p_business_type: businessType,
        p_start_date: startDate,
        p_end_date: endDate,
        p_client_search: clientSearch,
      }),
    ]);

    if (analysisRes.error) throw new Error(analysisRes.error.message);
    const d = analysisRes.data;

    // prevRanking → rankChange/isNew 계산
    const prevRanking: Record<string, number> = d.prevRanking || {};
    const hasPrev = Object.keys(prevRanking).length > 0;

    const clientRanking = (d.clientRanking || []).map(
      (c: {
        code: string;
        name: string;
        revenue: number;
        quantity: number;
        itemCount: number;
        rn: number;
        normal_total: number;
        selling_total: number;
      }) => {
        const currentRank = c.rn;
        const prevRank = prevRanking[c.code];
        const discountRate =
          c.normal_total > 0
            ? Math.round(
                ((c.normal_total - c.selling_total) / c.normal_total) * 1000
              ) / 10
            : null;
        return {
          code: c.code,
          name: c.name,
          revenue: c.revenue,
          quantity: c.quantity,
          itemCount: c.itemCount,
          rankChange:
            prevRank != null ? prevRank - currentRank : null,
          isNew: hasPrev && prevRank == null,
          discountRate,
        };
      }
    );

    // 담당자별 분석: 기본 정보 + 브랜드/업종 상세 병합
    const mgrBrands: Record<
      string,
      {
        brands: { brand: string; revenue: number }[];
        bizClients: { biz: string; count: number }[];
      }
    > = brandsRes.error ? {} : brandsRes.data || {};

    const managerAnalysis = (
      d.managerAnalysis || []
    ).map(
      (m: {
        manager: string;
        client_count: number;
        revenue: number;
        discount_rate: number | null;
      }) => ({
        manager: m.manager,
        clientCount: m.client_count,
        revenue: m.revenue,
        discountRate: m.discount_rate,
        brands: mgrBrands[m.manager]?.brands || [],
        bizClients: mgrBrands[m.manager]?.bizClients || [],
      })
    );

    return NextResponse.json({
      success: true,
      summary: {
        totalRevenue: d.summary?.total_revenue || 0,
        totalQuantity: d.summary?.total_quantity || 0,
        totalCount: d.summary?.total_count || 0,
      },
      clientRanking,
      managerAnalysis,
      businessAnalysis: d.businessAnalysis || [],
      brandAnalysis: d.brandAnalysis || [],
      countryAnalysis: d.countryAnalysis || [],
      dailyTrend: d.dailyTrend || [],
    });
  } catch (e) {
    return handleApiError(e);
  }
}
