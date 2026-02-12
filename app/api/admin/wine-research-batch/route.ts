// app/api/admin/wine-research-batch/route.ts - Claude 기반 일괄 와인 조사
import { NextRequest, NextResponse } from "next/server";
import { researchWineWithClaude } from "@/app/lib/claudeWineResearch";
import { getWineByCode, upsertWine, upsertTastingNote } from "@/app/lib/wineDb";
import { logChange } from "@/app/lib/changeLogDb";
import { handleApiError } from "@/app/lib/errors";
import { logger } from "@/app/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const { wine_ids } = await request.json();

    if (!wine_ids || !Array.isArray(wine_ids) || wine_ids.length === 0) {
      return NextResponse.json({ success: false, error: "wine_ids 배열이 필요합니다." }, { status: 400 });
    }

    const results: { wine_id: string; success: boolean; error?: string; item_name_en?: string }[] = [];

    for (const wineId of wine_ids) {
      try {
        const wine = await getWineByCode(wineId);
        if (!wine) {
          results.push({ wine_id: wineId, success: false, error: "와인을 찾을 수 없음" });
          continue;
        }

        const englishName = wine.item_name_en?.trim();
        if (!englishName) {
          results.push({ wine_id: wineId, success: false, error: "영문명 없음" });
          continue;
        }

        const result = await researchWineWithClaude(wineId, wine.item_name_kr, englishName);

        await upsertWine({
          item_code: wineId,
          item_name_en: result.item_name_en,
          country_en: result.country_en,
          region: result.region,
          grape_varieties: result.grape_varieties,
          wine_type: result.wine_type,
          alcohol: result.alcohol_percentage || null,
          ai_researched: 1,
          ...(result.image_url ? { image_url: result.image_url } : {}),
        });

        await upsertTastingNote(wineId, {
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

        await logChange('claude_batch_research', 'wine', wineId, { item_name_en: result.item_name_en });
        results.push({ wine_id: wineId, success: true, item_name_en: result.item_name_en });

      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error(`[BatchResearch] Failed for ${wineId}: ${msg}`);
        results.push({ wine_id: wineId, success: false, error: msg });
      }
    }

    const successCount = results.filter(r => r.success).length;
    return NextResponse.json({
      success: true,
      data: {
        total: wine_ids.length,
        succeeded: successCount,
        failed: wine_ids.length - successCount,
        results,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
