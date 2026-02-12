import { supabase } from "@/app/lib/db";
import { NextRequest, NextResponse } from "next/server";

// 거래처별 품목 조회 API (와인/와인잔 공통)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { client_code, type } = body;

    if (!client_code || !type) {
      return NextResponse.json(
        { success: false, message: "client_code와 type이 필요합니다" },
        { status: 400 }
      );
    }

    // 와인/와인잔에 따라 다른 테이블 사용
    const table = type === "wine" ? "client_item_stats" : "glass_client_item_stats";

    // 와인은 avg_price, Glass는 supply_price 컬럼명이 다름
    const priceCol = type === "wine" ? "avg_price" : "supply_price";

    // 거래처별 품목 조회 (최근 거래 품목)
    const selectCols =
      type === "wine"
        ? `item_no, item_name, avg_price`
        : `item_no, item_name, supply_price`;

    const { data: items, error } = await supabase
      .from(table)
      .select(selectCols)
      .eq("client_code", client_code)
      .order("item_no", { ascending: true });

    if (error) throw error;

    // avg_price → supply_price 로 통일 (wine 테이블인 경우)
    const normalized = (items || []).map((row: any) => ({
      item_no: row.item_no,
      item_name: row.item_name,
      supply_price: type === "wine" ? row.avg_price : row.supply_price,
    }));

    return NextResponse.json({
      success: true,
      items: normalized,
      count: normalized.length,
    });
  } catch (error: any) {
    console.error("거래처 품목 조회 실패:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
