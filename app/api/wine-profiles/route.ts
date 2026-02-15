import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { ensureWineProfileTable } from '@/app/lib/wineProfileDb';

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
      const { data: row, error } = await supabase
        .from('wine_profiles')
        .select('*')
        .eq('item_code', itemCode)
        .maybeSingle();
      if (error) throw error;
      return NextResponse.json({ success: true, profile: row || null });
    }

    if (itemCodesParam) {
      let codes: string[] = [];
      try { codes = JSON.parse(itemCodesParam); } catch {}
      if (codes.length === 0) {
        return NextResponse.json({ success: true, profiles: [] });
      }

      // wine_profiles 먼저 조회
      const { data: rows } = await supabase
        .from('wine_profiles')
        .select('*')
        .in('item_code', codes);

      const profileMap = new Map((rows || []).map((r: any) => [r.item_code, r]));

      // wine_profiles에 없는 코드는 wines 테이블에서 fallback
      const missingCodes = codes.filter(c => !profileMap.has(c));
      if (missingCodes.length > 0) {
        const { data: wineRows } = await supabase
          .from('wines')
          .select('item_code, country, country_en, region, grape_varieties, wine_type, alcohol, image_url, supplier, supplier_kr')
          .in('item_code', missingCodes);

        for (const w of (wineRows || [])) {
          profileMap.set(w.item_code, {
            item_code: w.item_code,
            country: w.country || w.country_en || '',
            region: w.region || '',
            grape_varieties: w.grape_varieties || '',
            wine_type: w.wine_type || '',
            alcohol: w.alcohol || '',
            description_kr: '',
          });
        }
      }

      return NextResponse.json({ success: true, profiles: Array.from(profileMap.values()) });
    }

    const { data: rows, error } = await supabase
      .from('wine_profiles')
      .select('*')
      .order('item_code', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ success: true, profiles: rows || [], count: (rows || []).length });
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

    const record: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const f of FIELDS) {
      if (body[f] !== undefined) {
        record[f] = body[f] ?? '';
      }
    }

    const { error: upsertError } = await supabase
      .from('wine_profiles')
      .upsert(record, { onConflict: 'item_code' });
    if (upsertError) throw upsertError;

    const { data: row, error: fetchError } = await supabase
      .from('wine_profiles')
      .select('*')
      .eq('item_code', body.item_code)
      .maybeSingle();
    if (fetchError) throw fetchError;

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

    const updates: Record<string, any> = {};
    for (const f of FIELDS) {
      if (f !== 'item_code' && body[f] !== undefined) {
        updates[f] = body[f] ?? '';
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '업데이트할 필드가 없습니다.' }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('wine_profiles')
      .update(updates)
      .eq('item_code', body.item_code);
    if (updateError) throw updateError;

    const { data: row, error: fetchError } = await supabase
      .from('wine_profiles')
      .select('*')
      .eq('item_code', body.item_code)
      .maybeSingle();
    if (fetchError) throw fetchError;

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

    const { error } = await supabase
      .from('wine_profiles')
      .delete()
      .eq('item_code', itemCode);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Wine profiles DELETE error:', error);
    return NextResponse.json(
      { error: '와인 프로필 삭제 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
