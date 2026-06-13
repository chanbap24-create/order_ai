import { NextRequest, NextResponse } from "next/server";
import { syncItemEmbeddings } from "@/app/lib/itemEmbeddingSync";

// 임베딩 동기화/백필. middleware 가 /api/admin/* 를 admin_auth 로 보호.
// POST body: { tab?: "CDV" | "DL" }  (없으면 둘 다)
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const tabs: Array<"CDV" | "DL"> = body?.tab === "CDV" || body?.tab === "DL" ? [body.tab] : ["CDV", "DL"];
    const results = [];
    for (const tab of tabs) results.push(await syncItemEmbeddings(tab));
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("embeddings sync error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "동기화 실패" },
      { status: 500 },
    );
  }
}
