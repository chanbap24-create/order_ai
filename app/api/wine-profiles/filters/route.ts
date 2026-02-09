import { NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { ensureWineProfileTable } from '@/app/lib/wineProfileDb';

export const runtime = 'nodejs';

export async function GET() {
  try {
    ensureWineProfileTable();

    const countries = (db.prepare(
      "SELECT DISTINCT country FROM wine_profiles WHERE country != '' ORDER BY country"
    ).all() as { country: string }[]).map(r => r.country);

    const regions = (db.prepare(
      "SELECT DISTINCT region FROM wine_profiles WHERE region != '' ORDER BY region"
    ).all() as { region: string }[]).map(r => r.region);

    const wineTypes = (db.prepare(
      "SELECT DISTINCT wine_type FROM wine_profiles WHERE wine_type != '' ORDER BY wine_type"
    ).all() as { wine_type: string }[]).map(r => r.wine_type);

    // grape_varieties: 쉼표 구분 문자열을 분리 후 중복 제거
    const grapeRows = (db.prepare(
      "SELECT DISTINCT grape_varieties FROM wine_profiles WHERE grape_varieties != ''"
    ).all() as { grape_varieties: string }[]);

    const grapeSet = new Set<string>();
    for (const row of grapeRows) {
      const varieties = row.grape_varieties.split(',').map(s => s.trim()).filter(Boolean);
      for (const v of varieties) {
        grapeSet.add(v);
      }
    }
    const grapeVarieties = Array.from(grapeSet).sort();

    return NextResponse.json({
      success: true,
      countries,
      regions,
      wineTypes,
      grapeVarieties,
    });
  } catch (error) {
    console.error('Wine profiles filters error:', error);
    return NextResponse.json(
      { error: '필터 옵션 조회 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
