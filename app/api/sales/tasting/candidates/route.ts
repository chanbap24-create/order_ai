import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { listTastingCandidates, getAiCandidates } from "@/app/lib/tasting/candidates";
import { WINE_TYPES, type TastingSettings } from "@/app/lib/tasting/settings";

// 시음주 후보 미리보기.
//  - client_code 있으면: 그 거래처 AI 추천견적 후보(점수순, 필터는 클라이언트에서)
//  - 없으면: 필터 통과 재고(재고 최다순)
// GET ?company=&client_code=&min_stock=&price_min=&price_max=&wine_types=레드,화이트
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    const sp = new URL(req.url).searchParams;
    const company = sp.get("company") === "DL" ? "DL" : "CDV";
    const clientCode = (sp.get("client_code") || "").trim();

    if (clientCode && company === "CDV") {
      const candidates = await getAiCandidates(clientCode, company);
      return NextResponse.json({ candidates, source: "ai" });
    }

    const num = (k: string) => (sp.get(k) == null || sp.get(k) === "" ? null : Number(sp.get(k)) || 0);
    const wine_types = (sp.get("wine_types") || "")
      .split(",")
      .map((x) => x.trim())
      .filter((x) => (WINE_TYPES as readonly string[]).includes(x));
    const settings: TastingSettings = {
      company,
      min_stock: Number(sp.get("min_stock")) || 0,
      price_min: num("price_min"),
      price_max: num("price_max"),
      wine_types,
    };
    const candidates = await listTastingCandidates(company, settings, 50);
    return NextResponse.json({ candidates, source: "stock" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
