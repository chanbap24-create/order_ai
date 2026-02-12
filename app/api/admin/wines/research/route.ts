// app/api/admin/wines/research/route.ts
import { NextRequest, NextResponse } from "next/server";
import { researchWine } from "@/app/lib/wineResearch";
import { logChange } from "@/app/lib/changeLogDb";
import { handleApiError } from "@/app/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const { itemCode, itemNameKr, itemNameEn } = await request.json();

    if (!itemCode || !itemNameKr) {
      return NextResponse.json({ success: false, error: "itemCode와 itemNameKr이 필요합니다." }, { status: 400 });
    }

    const result = await researchWine(itemCode, itemNameKr, itemNameEn || '');

    await logChange('ai_research', 'wine', itemCode, { item_name: itemNameKr });

    // 와인 업데이트용 데이터 분리
    const wineUpdate = {
      item_name_en: result.item_name_en,
      country_en: result.country_en,
      region: result.region,
      grape_varieties: result.grape_varieties,
      wine_type: result.wine_type,
    };

    return NextResponse.json({
      success: true,
      data: {
        research: result,
        wineUpdate,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
