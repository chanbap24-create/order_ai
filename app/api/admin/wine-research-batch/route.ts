// app/api/admin/wine-research-batch/route.ts - Claude 기반 일괄 와인 조사
import { NextRequest, NextResponse } from "next/server";
import { researchWineWithClaude } from "@/app/lib/claudeWineResearch";
import { getWineByCode, upsertWine, upsertTastingNote } from "@/app/lib/wineDb";
import { logChange } from "@/app/lib/changeLogDb";
import { handleApiError } from "@/app/lib/errors";
import { logger } from "@/app/lib/logger";
import { supabase } from "@/app/lib/db";
import { ensureRegionsClassified } from "../wine-regions/lib/classify";

const CONCURRENCY = 2;

async function processOneWine(wineId: string): Promise<{
  wine_id: string;
  success: boolean;
  error?: string;
  item_name_en?: string;
  validation?: { confidence: number; issues: string[] };
}> {
  const wine = await getWineByCode(wineId);
  if (!wine) {
    return { wine_id: wineId, success: false, error: "와인을 찾을 수 없음" };
  }

  const englishName = wine.item_name_en?.trim();
  if (!englishName) {
    return { wine_id: wineId, success: false, error: "영문명 없음" };
  }

  const { result, validation } = await researchWineWithClaude(wineId, wine.item_name_kr, englishName);

  // confidence < 50 → 저장하지 않음
  if (validation.confidence < 50) {
    return {
      wine_id: wineId,
      success: false,
      error: `다른 와인 조사됨 (confidence: ${validation.confidence})`,
      validation,
    };
  }

  if (validation.confidence < 80) {
    await logChange('claude_batch_research_warning', 'wine', wineId, {
      item_name_en: result.item_name_en,
      validation_confidence: validation.confidence,
      validation_issues: validation.issues,
    });
  }

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
  });

  await logChange('claude_batch_research', 'wine', wineId, { item_name_en: result.item_name_en });
  return { wine_id: wineId, success: true, item_name_en: result.item_name_en, validation };
}

export async function POST(request: NextRequest) {
  try {
    const { wine_ids } = await request.json();

    if (!wine_ids || !Array.isArray(wine_ids) || wine_ids.length === 0) {
      return NextResponse.json({ success: false, error: "wine_ids 배열이 필요합니다." }, { status: 400 });
    }

    const results: Awaited<ReturnType<typeof processOneWine>>[] = [];

    // 동시 2개씩 처리 (Claude API rate limit 고려)
    for (let i = 0; i < wine_ids.length; i += CONCURRENCY) {
      const batch = wine_ids.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(batch.map(processOneWine));

      for (let j = 0; j < batchResults.length; j++) {
        const settled = batchResults[j];
        if (settled.status === 'fulfilled') {
          results.push(settled.value);
        } else {
          const msg = settled.reason instanceof Error ? settled.reason.message : String(settled.reason);
          logger.error(`[BatchResearch] Failed for ${batch[j]}: ${msg}`);
          results.push({ wine_id: batch[j], success: false, error: msg });
        }
      }
    }

    const successCount = results.filter(r => r.success).length;

    // 조사 성공한 와인들의 산지를 와인산지DB에 일괄 자동 반영(미분류만 LLM 분류, 1회 호출)
    try {
      const okIds = results.filter(r => r.success).map(r => r.wine_id);
      if (okIds.length > 0) {
        const { data: okWines } = await supabase
          .from('wines').select('region, item_name_kr, item_name_en, country_en, country').in('item_code', okIds);
        await ensureRegionsClassified(
          (okWines || []).map(w => ({
            region: w.region, name: `${w.item_name_kr || ''} ${w.item_name_en || ''}`, country: w.country_en || w.country || '',
          })),
        );
      }
    } catch (e) {
      logger.error(`[BatchResearch] region auto-classify failed: ${e instanceof Error ? e.message : String(e)}`);
    }

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
