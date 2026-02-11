// app/api/admin/wine-research/route.ts - Claude 기반 개별 와인 조사
import { NextRequest, NextResponse } from "next/server";
import { researchWineWithClaude } from "@/app/lib/claudeWineResearch";
import { upsertWine, upsertTastingNote } from "@/app/lib/wineDb";
import { logChange } from "@/app/lib/changeLogDb";
import { handleApiError } from "@/app/lib/errors";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { wine_id, product_name_eng, item_name_kr, vintage } = await request.json();

    if (!wine_id) {
      return NextResponse.json({ success: false, error: "wine_id가 필요합니다." }, { status: 400 });
    }
    if (!product_name_eng?.trim()) {
      return NextResponse.json({ success: false, error: "영문명(product_name_eng)이 필요합니다." }, { status: 400 });
    }

    const result = await researchWineWithClaude(
      wine_id,
      item_name_kr || '',
      product_name_eng.trim(),
      vintage || undefined
    );

    // wines 테이블 업데이트
    upsertWine({
      item_code: wine_id,
      item_name_en: result.item_name_en,
      country_en: result.country_en,
      region: result.region,
      grape_varieties: result.grape_varieties,
      wine_type: result.wine_type,
      alcohol: result.alcohol_percentage || null,
      ai_researched: 1,
      ...(result.image_url ? { image_url: result.image_url } : {}),
    });

    // tasting_notes 테이블 업데이트
    upsertTastingNote(wine_id, {
      winemaking: result.winemaking,
      winery_description: result.winery_description,
      vintage_note: result.vintage_note,
      aging_potential: result.aging_potential,
      color_note: result.color_note,
      nose_note: result.nose_note,
      palate_note: result.palate_note,
      food_pairing: result.food_pairing,
      glass_pairing: result.glass_pairing,
      serving_temp: result.serving_temp,
      awards: result.awards,
      ai_generated: 1,
      manually_edited: 0,
      approved: 0,
    });

    logChange('claude_research', 'wine', wine_id, { item_name_en: result.item_name_en });

    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    return handleApiError(e);
  }
}
