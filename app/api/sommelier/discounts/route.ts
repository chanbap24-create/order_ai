// 소믈리에 할인 밴드 조회/수정 — 조회는 세일즈 세션 전체, 수정은 권한자만.
// MVP: 밴드 구간은 고정, 할인율(rate)만 수정. 로직은 app/lib/sommelierDiscount.ts.
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { supabase } from '@/app/lib/db';
import { canEditDiscounts, loadDiscountBands } from '@/app/lib/sommelierDiscount';
import { handleApiError } from '@/app/lib/errors';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
    const bands = await loadDiscountBands();
    return NextResponse.json({ success: true, bands, canEdit: canEditDiscounts(session), manager: session.manager });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
    if (!canEditDiscounts(session)) {
      return NextResponse.json({ success: false, error: '할인율 조정 권한이 없습니다.' }, { status: 403 });
    }
    const body = await req.json();
    const bands: { id: number; rate: number }[] = Array.isArray(body?.bands) ? body.bands : [];
    if (!bands.length) return NextResponse.json({ success: false, error: '수정할 밴드가 없습니다.' }, { status: 400 });

    for (const b of bands) {
      const id = Number(b.id);
      const rate = Number(b.rate);
      if (!Number.isInteger(id) || !Number.isFinite(rate) || rate < 0 || rate > 70) {
        return NextResponse.json({ success: false, error: '할인율은 0~70% 사이여야 합니다.' }, { status: 400 });
      }
      const { error } = await supabase.from('sommelier_discount_bands')
        .update({ rate, updated_by: session.manager, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    }
    const updated = await loadDiscountBands();
    return NextResponse.json({ success: true, bands: updated });
  } catch (e) {
    return handleApiError(e);
  }
}
