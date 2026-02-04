import { db } from "@/app/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// ✅ 거래처별 품목 조회 API (와인/와인잔 공통)
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

    // ✅ 와인/와인잔에 따라 다른 테이블 사용
    const table = type === "wine" ? "client_item_stats" : "glass_client_item_stats";

    // ✅ 거래처별 품목 조회 (최근 거래 품목)
    const items = db
      .prepare(
        `SELECT item_no, item_name, avg_price as supply_price, last_ship_date 
         FROM ${table} 
         WHERE client_code = ? 
         ORDER BY item_no ASC`
      )
      .all(client_code) as Array<{
      item_no: string;
      item_name: string;
      supply_price: number;
      last_ship_date: string;
    }>;

    return NextResponse.json({
      success: true,
      items,
      count: items.length,
    });
  } catch (error: any) {
    console.error("거래처 품목 조회 실패:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
