import { NextResponse } from "next/server";
import { jsonResponse } from "@/app/lib/api-response";
import { db } from "@/app/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const alias = String(body?.alias || "").trim();
    const clientCode = String(body?.client_code || "*").trim(); // ✅ 기본값 '*'
    
    if (!alias) {
      return jsonResponse({ success: false, error: "alias required" }, { status: 400 });
    }

    // ✅ (alias, client_code) 복합 키로 삭제
    const result = db.prepare(`
      DELETE FROM item_alias WHERE alias = ? AND client_code = ?
    `).run(alias, clientCode);

    console.log(`[delete-item-alias] 삭제: alias="${alias}", client_code="${clientCode}", changes=${result.changes}`);

    return jsonResponse({ success: true, deleted: result.changes });
  } catch (e: any) {
    console.error('[delete-item-alias] 오류:', e);
    return jsonResponse(
      { success: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
