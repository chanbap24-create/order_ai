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

export async function GET(request: NextRequest) {
  try {
    ensureWineProfileTable();
    const params = request.nextUrl.searchParams;
    const itemCode = params.get('item_code');
    const itemCodesParam = params.get('item_codes');

    if (itemCode) {
      const row = db.prepare('SELECT * FROM wine_profiles WHERE item_code = ?').get(itemCode);
      return NextResponse.json({ success: true, profile: row || null });
    }

    if (itemCodesParam) {
      let codes: string[] = [];
      try { codes = JSON.parse(itemCodesParam); } catch {}
      if (codes.length === 0) {
        return NextResponse.json({ success: true, profiles: [] });
      }
      const placeholders = codes.map(() => '?').join(',');
      const rows = db.prepare(`SELECT * FROM wine_profiles WHERE item_code IN (${placeholders})`).all(...codes);
      return NextResponse.json({ success: true, profiles: rows });
    }

    const rows = db.prepare('SELECT * FROM wine_profiles ORDER BY item_code ASC').all();
    return NextResponse.json({ success: true, profiles: rows, count: rows.length });
  } catch (error) {
    console.error('Wine profiles GET error:', error);
    return NextResponse.json(
      { error: '와인 프로필 조회 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    ensureWineProfileTable();
    const body = await request.json();

    if (!body.item_code) {
      return NextResponse.json({ error: 'item_code는 필수입니다.' }, { status: 400 });
    }

    const cols = FIELDS.filter(f => body[f] !== undefined);
    const vals = cols.map(f => body[f] ?? '');
    const placeholders = cols.map(() => '?').join(',');

    db.prepare(
      `INSERT OR REPLACE INTO wine_profiles (${cols.join(',')}, updated_at) VALUES (${placeholders}, datetime('now'))`
    ).run(...vals);

    const row = db.prepare('SELECT * FROM wine_profiles WHERE item_code = ?').get(body.item_code);
    return NextResponse.json({ success: true, profile: row });
  } catch (error) {
    console.error('Wine profiles POST error:', error);
    return NextResponse.json(
      { error: '와인 프로필 저장 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    ensureWineProfileTable();
    const body = await request.json();

    if (!body.item_code) {
      return NextResponse.json({ error: 'item_code는 필수입니다.' }, { status: 400 });
    }

    const updates = FIELDS.filter(f => f !== 'item_code' && body[f] !== undefined);
    if (updates.length === 0) {
      return NextResponse.json({ error: '업데이트할 필드가 없습니다.' }, { status: 400 });
    }

    const setClauses = updates.map(f => `${f} = ?`).join(', ');
    const vals = updates.map(f => body[f] ?? '');

    db.prepare(
      `UPDATE wine_profiles SET ${setClauses}, updated_at = datetime('now') WHERE item_code = ?`
    ).run(...vals, body.item_code);

    const row = db.prepare('SELECT * FROM wine_profiles WHERE item_code = ?').get(body.item_code);
    return NextResponse.json({ success: true, profile: row });
  } catch (error) {
    console.error('Wine profiles PATCH error:', error);
    return NextResponse.json(
      { error: '와인 프로필 수정 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    ensureWineProfileTable();
    const itemCode = request.nextUrl.searchParams.get('item_code');

    if (!itemCode) {
      return NextResponse.json({ error: 'item_code는 필수입니다.' }, { status: 400 });
    }

    db.prepare('DELETE FROM wine_profiles WHERE item_code = ?').run(itemCode);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Wine profiles DELETE error:', error);
    return NextResponse.json(
      { error: '와인 프로필 삭제 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
