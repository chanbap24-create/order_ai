import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { ensureWineProfileTable } from '@/app/lib/wineProfileDb';

export const runtime = 'nodejs';

const FIELDS = [
  'item_code', 'country', 'region', 'sub_region', 'appellation',
  'grape_varieties', 'wine_type', 'body', 'sweetness',
  'tasting_aroma', 'tasting_palate', 'food_pairing',
  'description_kr', 'description_en', 'alcohol', 'serving_temp', 'aging_potential',
];

export async function POST(request: NextRequest) {
  try {
    ensureWineProfileTable();
    const body = await request.json();
    const profiles = body.profiles as any[];

    if (!Array.isArray(profiles) || profiles.length === 0) {
      return NextResponse.json({ error: 'profiles 배열이 필요합니다.' }, { status: 400 });
    }

    const cols = FIELDS;
    const placeholders = cols.map(() => '?').join(',');
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO wine_profiles (${cols.join(',')}, updated_at) VALUES (${placeholders}, datetime('now'))`
    );

    let imported = 0;
    let skipped = 0;

    db.transaction(() => {
      for (const profile of profiles) {
        if (!profile.item_code) {
          skipped++;
          continue;
        }
        const vals = cols.map(f => profile[f] ?? '');
        stmt.run(...vals);
        imported++;
      }
    })();

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: profiles.length,
    });
  } catch (error) {
    console.error('Wine profiles import error:', error);
    return NextResponse.json(
      { error: '벌크 임포트 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
