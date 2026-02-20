import { NextRequest, NextResponse } from "next/server";
import { researchBrandWithClaude } from "@/app/lib/claudeBrandResearch";

// POST /api/admin/brands/research — AI 브랜드 조사 (3단계 병렬검색 + 검증)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { brand_name_kr, brand_name_en, country } = body;

  if (!brand_name_kr) {
    return NextResponse.json({ error: "brand_name_kr is required" }, { status: 400 });
  }

  try {
    const { result, validation } = await researchBrandWithClaude(brand_name_kr, brand_name_en, country);
    return NextResponse.json({ result, validation });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
