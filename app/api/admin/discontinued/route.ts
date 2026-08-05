// 단종 관리 (어드민) — 브랜드 단위. 전체 브랜드 목록 + 단종 설정/해제 (brands.discontinued)
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { handleApiError } from '@/app/lib/errors';

export async function GET() {
  try {
    // 브랜드 자료실 + 와인에만 있는 브랜드 코드 합집합, 품목 수 포함
    const [{ data: brands, error: be }, { data: wines, error: we }] = await Promise.all([
      supabase.from('brands').select('brand_code, brand_name_kr, brand_name_en, discontinued'),
      supabase.from('wines').select('brand').not('brand', 'is', null).limit(20000),
    ]);
    if (be) throw be;
    if (we) throw we;

    const counts = new Map<string, number>();
    for (const w of wines || []) {
      const c = String(w.brand || '').toUpperCase().trim();
      if (c) counts.set(c, (counts.get(c) || 0) + 1);
    }

    const byCode = new Map<string, { brand_code: string; name: string; name_en: string; discontinued: boolean; wine_count: number }>();
    for (const b of brands || []) {
      const code = String(b.brand_code || '').toUpperCase().trim();
      if (!code) continue;
      byCode.set(code, {
        brand_code: code,
        name: b.brand_name_kr || code,
        name_en: b.brand_name_en || '',
        discontinued: !!b.discontinued,
        wine_count: counts.get(code) || 0,
      });
    }
    // 자료실에 없는데 와인엔 있는 브랜드 코드도 표시(선택 가능해야 함)
    for (const [code, n] of counts) {
      if (!byCode.has(code)) {
        byCode.set(code, { brand_code: code, name: code, name_en: '', discontinued: false, wine_count: n });
      }
    }
    const list = [...byCode.values()].sort((a, b) =>
      Number(b.discontinued) - Number(a.discontinued) || a.name.localeCompare(b.name, 'ko'));
    return NextResponse.json({ brands: list });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { brandCode, discontinued } = await req.json();
    const code = String(brandCode || '').toUpperCase().trim();
    if (!code) return NextResponse.json({ error: 'brandCode가 필요합니다.' }, { status: 400 });
    // 자료실에 없는 브랜드 코드는 행을 만들어 플래그 저장
    const { data: exist } = await supabase.from('brands').select('id').ilike('brand_code', code).maybeSingle();
    if (exist) {
      const { error } = await supabase.from('brands').update({ discontinued: !!discontinued }).eq('id', exist.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('brands')
        .insert({ brand_code: code, brand_name_kr: code, discontinued: !!discontinued });
      if (error) throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
