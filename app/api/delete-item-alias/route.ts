import { NextResponse } from "next/server";
import { jsonResponse } from "@/app/lib/api-response";
import { supabase } from "@/app/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const alias = String(body?.alias || "").trim();
    const clientCode = String(body?.client_code || "*").trim(); // 기본값 '*'

    if (!alias) {
      return jsonResponse(
        { success: false, error: "alias required" },
        { status: 400 }
      );
    }

    // (alias, client_code) 복합 키로 삭제
    const { data, error, count } = await supabase
      .from("item_alias")
      .delete()
      .eq("alias", alias)
      .eq("client_code", clientCode)
      .select("*", { count: "exact" });

    if (error) throw error;

    const deleted = count ?? (data ? data.length : 0);

    console.log(
      `[delete-item-alias] 삭제: alias="${alias}", client_code="${clientCode}", deleted=${deleted}`
    );

    return jsonResponse({ success: true, deleted });
  } catch (e: any) {
    console.error("[delete-item-alias] 오류:", e);
    return jsonResponse(
      { success: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
