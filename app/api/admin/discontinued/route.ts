// 단종 관리 (어드민) — 검색/단종 목록 조회 + 단종 설정·해제 (wines.status 기준)
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { handleApiError } from '@/app/lib/errors';
import { sanitizeFilterValue } from '@/app/lib/validation';

export async function GET(req: NextRequest) {
  try {
    const search = (req.nextUrl.searchParams.get('search') || '').trim().slice(0, 50);
    const onlyDiscontinued = req.nextUrl.searchParams.get('discontinued') === '1';
    let q = supabase.from('wines')
      .select('item_code, item_name_kr, item_name_en, brand, status, available_stock')
      .order('item_name_kr').limit(100);
    if (onlyDiscontinued) q = q.eq('status', 'discontinued');
    if (search) {
      const v = sanitizeFilterValue(search);
      q = q.or(`item_name_kr.ilike.%${v}%,item_name_en.ilike.%${v}%,item_code.ilike.%${v}%`);
    }
    if (!search && !onlyDiscontinued) return NextResponse.json({ wines: [] });
    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({ wines: data || [] });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { itemCode, discontinued } = await req.json();
    const code = String(itemCode || '').trim();
    if (!code) return NextResponse.json({ error: 'itemCode가 필요합니다.' }, { status: 400 });
    const { error } = await supabase.from('wines')
      .update({ status: discontinued ? 'discontinued' : 'active' })
      .eq('item_code', code);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
