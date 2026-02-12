// app/api/confirm-item-alias/route.ts
import { NextResponse } from "next/server";
import { jsonResponse } from "@/app/lib/api-response";
import { supabase } from "@/app/lib/db";

function normAlias(s: any) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[()\-_/.,]/g, " ");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const aliasRaw = body?.alias; // 사용자가 입력한 표현(예: "샤블리 프리미에 2")
    const client_code = body?.client_code ? String(body.client_code) : null; // 선택(거래처별 학습)
    const item_no = String(body?.item_no || "");
    const item_name = String(body?.item_name || "");

    const alias = normAlias(aliasRaw);
    if (!alias || !item_no) {
      return jsonResponse(
        { success: false, error: "alias, item_no는 필수입니다." },
        { status: 400 }
      );
    }

    // Supabase에 item_alias 테이블이 이미 존재한다고 가정 (DDL은 Supabase 대시보드에서 관리)

    const { error } = await supabase.from("item_alias").insert({
      alias,
      item_no,
      item_name,
      client_code,
      created_at: new Date().toISOString(),
    });

    if (error) throw error;

    return jsonResponse({ success: true });
  } catch (e: any) {
    return jsonResponse(
      { success: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
