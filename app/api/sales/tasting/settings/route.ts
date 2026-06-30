import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { getTastingSettings, upsertTastingSettings, WINE_TYPES } from "@/app/lib/tasting/settings";

// 시음주 선정 설정(법인별 재고/가격/타입 필터). GET ?company=CDV|DL / PUT { company, min_stock, price_min, price_max, wine_types }
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    const company = new URL(req.url).searchParams.get("company") === "DL" ? "DL" : "CDV";
    const settings = await getTastingSettings(company);
    return NextResponse.json({ settings });
  } catch (err) {
    console.error("GET /api/sales/tasting/settings error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    const body = await req.json();
    const company = body.company === "DL" ? "DL" : "CDV";
    const wine_types = Array.isArray(body.wine_types)
      ? body.wine_types.filter((w: string) => (WINE_TYPES as readonly string[]).includes(w))
      : [];
    const num = (v: unknown) => (v == null || v === "" ? null : Number(v) || 0);
    await upsertTastingSettings(
      {
        company,
        min_stock: Number(body.min_stock) || 0,
        price_min: num(body.price_min),
        price_max: num(body.price_max),
        wine_types,
      },
      session.manager,
    );
    const settings = await getTastingSettings(company);
    return NextResponse.json({ settings });
  } catch (err) {
    console.error("PUT /api/sales/tasting/settings error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
