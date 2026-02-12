import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { ensureWineProfileTable } from '@/app/lib/wineProfileDb';

export async function GET(request: NextRequest) {
  try {
    ensureWineProfileTable();

    const source = request.nextUrl.searchParams.get('source') || ''; // 'CDV' | 'DL'

    // country: 선택된 소스의 inventory 테이블에서 조회
    const countrySet = new Set<string>();

    if (source === 'DL') {
      try {
        const { data: rows } = await supabase
          .from('inventory_dl')
          .select('country')
          .not('country', 'eq', '')
          .not('country', 'is', null);
        if (rows) {
          const unique = new Set(rows.map((r: any) => r.country));
          for (const c of unique) countrySet.add(c);
        }
      } catch {}
    } else {
      // CDV 또는 미지정 시 CDV 기본
      try {
        const { data: rows } = await supabase
          .from('inventory_cdv')
          .select('country')
          .not('country', 'eq', '')
          .not('country', 'is', null);
        if (rows) {
          const unique = new Set(rows.map((r: any) => r.country));
          for (const c of unique) countrySet.add(c);
        }
      } catch {}
    }

    const countries = Array.from(countrySet).sort();

    const { data: regionRows } = await supabase
      .from('wine_profiles')
      .select('region')
      .not('region', 'eq', '')
      .order('region', { ascending: true });
    const regions = Array.from(new Set((regionRows || []).map((r: any) => r.region)));

    const { data: wineTypeRows } = await supabase
      .from('wine_profiles')
      .select('wine_type')
      .not('wine_type', 'eq', '')
      .order('wine_type', { ascending: true });
    const wineTypes = Array.from(new Set((wineTypeRows || []).map((r: any) => r.wine_type)));

    // grape_varieties: 쉼표 구분 문자열을 분리 후 중복 제거
    const { data: grapeRows } = await supabase
      .from('wine_profiles')
      .select('grape_varieties')
      .not('grape_varieties', 'eq', '');

    const grapeSet = new Set<string>();
    for (const row of (grapeRows || [])) {
      const varieties = (row.grape_varieties as string).split(',').map((s: string) => s.trim()).filter(Boolean);
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
