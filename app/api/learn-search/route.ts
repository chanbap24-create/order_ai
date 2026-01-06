// app/api/learn-search/route.ts
import { NextResponse } from "next/server";
import { upsertSearchLearning } from "@/app/lib/searchLearning";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const raw = String(body?.raw ?? "").trim();     // 사용자가 입력한 원문(품목 name)
    const item_no = String(body?.item_no ?? "").trim();

    if (!raw || !item_no) {
      return NextResponse.json(
        { success: false, error: "raw/item_no required" },
        { status: 400 }
      );
    }

    const r = upsertSearchLearning(raw, item_no);

    return NextResponse.json({
      success: true,
      ...r,
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
