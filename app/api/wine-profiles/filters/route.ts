import { NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { ensureWineProfileTable } from '@/app/lib/wineProfileDb';

export const runtime = 'nodejs';

export async function GET() {
  try {
    ensureWineProfileTable();

    // country: inventory 테이블 + wine_profiles 모두에서 조회 후 합산
    const countrySet = new Set<string>();

    // wine_profiles 국가
    try {
      const wpCountries = db.prepare(
        "SELECT DISTINCT country FROM wine_profiles WHERE country != '' AND country IS NOT NULL"
      ).all() as { country: string }[];
      for (const r of wpCountries) countrySet.add(r.country);
    } catch {}

    // inventory_cdv 국가
    try {
      const cdvCountries = db.prepare(
        "SELECT DISTINCT country FROM inventory_cdv WHERE country != '' AND country IS NOT NULL"
      ).all() as { country: string }[];
      for (const r of cdvCountries) countrySet.add(r.country);
    } catch {}

    // inventory_dl 국가
    try {
      const dlCountries = db.prepare(
        "SELECT DISTINCT country FROM inventory_dl WHERE country != '' AND country IS NOT NULL"
      ).all() as { country: string }[];
      for (const r of dlCountries) countrySet.add(r.country);
    } catch {}

    const countries = Array.from(countrySet).sort();

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
