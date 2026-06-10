// app/api/admin/wine-research/route.ts - Claude 기반 개별 와인 조사
import { NextRequest, NextResponse } from "next/server";
import { researchWineWithClaude } from "@/app/lib/claudeWineResearch";
import { upsertWine, upsertTastingNote } from "@/app/lib/wineDb";
import { logChange } from "@/app/lib/changeLogDb";
import { handleApiError } from "@/app/lib/errors";
import { supabase } from "@/app/lib/db";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { wine_id, product_name_eng, item_name_kr, vintage, supplier: reqSupplier } = await request.json();

    if (!wine_id) {
      return NextResponse.json({ success: false, error: "wine_id가 필요합니다." }, { status: 400 });
    }
    if (!product_name_eng?.trim()) {
      return NextResponse.json({ success: false, error: "영문명(product_name_eng)이 필요합니다." }, { status: 400 });
    }

    // wines 테이블에서 생산자 정보 조회
    let supplierName = reqSupplier || '';
    if (!supplierName) {
      const { data: wineRow } = await supabase
        .from('wines')
        .select('supplier, supplier_kr')
        .eq('item_code', wine_id)
        .single();
      if (wineRow) {
        supplierName = wineRow.supplier || wineRow.supplier_kr || '';
      }
    }

    const { result, validation, verification_status } = await researchWineWithClaude(
      wine_id,
      item_name_kr || '',
      product_name_eng.trim(),
      vintage || undefined,
      supplierName || undefined
    );

    // mismatch여도 결과는 저장한다 (조사 비용 보존) — 상태 배지(X 생산자 불일치)로 검토 유도.
    // 이전엔 여기서 결과를 버리고 에러를 반환해, API 비용만 쓰고 아무것도 남지 않았음.
    if (verification_status === 'mismatch') {
      await logChange('claude_research_mismatch', 'wine', wine_id, {
        item_name_en: result.item_name_en,
        validation_confidence: validation.confidence,
        validation_issues: validation.issues,
      });
    }

    // confidence 50~79 → 저장하되 warning 로그
    if (verification_status !== 'mismatch' && validation.confidence < 80) {
      await logChange('claude_research_warning', 'wine', wine_id, {
        item_name_en: result.item_name_en,
        validation_confidence: validation.confidence,
        validation_issues: validation.issues,
      });
    }

    // wines 테이블 업데이트 (사용자가 저장한 영문명은 덮어쓰지 않음)
    const userEnName = product_name_eng.trim();
    await upsertWine({
      item_code: wine_id,
      item_name_en: userEnName || result.item_name_en,
      country_en: result.country_en,
      region: result.region,
      grape_varieties: result.grape_varieties,
      wine_type: result.wine_type,
      alcohol: result.alcohol_percentage || null,
      ai_researched: 1,
      ...(result.image_url ? { image_url: result.image_url } : {}),
    });

    // tasting_notes 테이블 업데이트 (verification_status 포함)
    await upsertTastingNote(wine_id, {
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
      verification_status,
    } as Record<string, unknown>);

    await logChange('claude_research', 'wine', wine_id, { item_name_en: result.item_name_en, verification_status });

    return NextResponse.json({
      success: true,
      data: result,
      validation,
      verification_status,
      ...(verification_status === 'mismatch'
        ? { message: "생산자가 다른 와인일 수 있습니다. 결과는 저장했으니 내용을 확인해주세요." }
        : {}),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = (e as { status?: number })?.status;
    const detail = status ? `(API status: ${status})` : '';
    console.error('[wine-research] ERROR:', msg, detail, e instanceof Error ? e.stack : '');
    return NextResponse.json({ success: false, error: `${msg} ${detail}`.trim() }, { status: 500 });
  }
}
