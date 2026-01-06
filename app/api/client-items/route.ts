import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { client_code, type = "wine" } = body;

    if (!client_code) {
      return NextResponse.json(
        { success: false, error: "client_code is required" },
        { status: 400 }
      );
    }

    // 와인 또는 와인잔 테이블 선택
    const table = type === "glass" ? "glass_client_item_stats" : "client_item_stats";

    // 거래처의 모든 품목 조회 (품목명 순 정렬)
    const items = db
      .prepare(
        `SELECT item_no, item_name, supply_price 
         FROM ${table} 
         WHERE client_code = ? 
         ORDER BY item_name`
      )
      .all(client_code);

    return NextResponse.json({
      success: true,
      client_code,
      type,
      items,
      count: items.length,
    });
  } catch (error: any) {
    console.error("Error in /api/client-items:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
