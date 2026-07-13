/**
 * 테이스팅 노트 없는 품목 일괄 조사 — admin/wine-research 라우트와 동일 플로우.
 * 실행: npx -y tsx --env-file=.env.local scripts/research-missing-notes.ts <품번...>
 * 각 품번: wines에서 영문명·빈티지·생산자 로드 → researchWineWithClaude →
 *          upsertWine + upsertTastingNote(flavor_tags 자동) + 산지 분류.
 */
import { researchWineWithClaude } from '@/app/lib/claudeWineResearch';
import { upsertWine, upsertTastingNote } from '@/app/lib/wineDb';
import { logChange } from '@/app/lib/changeLogDb';
import { ensureRegionsClassified } from '@/app/api/admin/wine-regions/lib/classify';
import { supabase } from '@/app/lib/db';

async function main() {
const codes = process.argv.slice(2);
if (codes.length === 0) {
  console.error('사용법: tsx scripts/research-missing-notes.ts <품번...>');
  process.exit(1);
}

for (const code of codes) {
  const { data: w } = await supabase
    .from('wines')
    .select('item_code, item_name_kr, item_name_en, vintage, supplier, supplier_kr')
    .eq('item_code', code)
    .single();
  if (!w?.item_name_en) {
    console.log(`[SKIP] ${code} — wines에 영문명 없음`);
    continue;
  }

  console.log(`[조사] ${code} ${w.item_name_kr} (${w.item_name_en}, v=${w.vintage || '-'})`);
  try {
    const { result, validation, verification_status } = await researchWineWithClaude(
      code,
      w.item_name_kr || '',
      w.item_name_en.trim(),
      w.vintage || undefined,
      w.supplier || w.supplier_kr || undefined,
    );

    if (verification_status === 'mismatch') {
      await logChange('claude_research_mismatch', 'wine', code, {
        item_name_en: result.item_name_en,
        validation_confidence: validation.confidence,
        validation_issues: validation.issues,
      });
    } else if (validation.confidence < 80) {
      await logChange('claude_research_warning', 'wine', code, {
        item_name_en: result.item_name_en,
        validation_confidence: validation.confidence,
        validation_issues: validation.issues,
      });
    }

    await upsertWine({
      item_code: code,
      item_name_en: w.item_name_en || result.item_name_en,
      country_en: result.country_en,
      region: result.region,
      grape_varieties: result.grape_varieties,
      wine_type: result.wine_type,
      alcohol: result.alcohol_percentage || null,
      ai_researched: 1,
      ...(result.image_url ? { image_url: result.image_url } : {}),
    });

    await upsertTastingNote(code, {
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
      flavor_tags: result.flavor_tags && result.flavor_tags.length ? result.flavor_tags : null,
      flavor_research_at: result.flavor_tags && result.flavor_tags.length ? new Date().toISOString() : null,
      ai_generated: 1,
      verification_status,
    } as Record<string, unknown>);

    await logChange('claude_research', 'wine', code, { item_name_en: result.item_name_en, verification_status });

    try {
      await ensureRegionsClassified([
        { region: result.region, name: `${w.item_name_kr || ''} ${w.item_name_en || ''}`, country: result.country_en },
      ]);
    } catch { /* 산지 분류 실패는 무시 */ }

    console.log(`[완료] ${code} — 상태=${verification_status} 신뢰도=${validation.confidence} 향미태그=${result.flavor_tags?.length || 0}개`);
  } catch (e) {
    console.log(`[실패] ${code} — ${e instanceof Error ? e.message : String(e)}`);
  }
}
console.log('끝.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
