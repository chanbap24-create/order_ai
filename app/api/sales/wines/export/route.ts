// GET /api/sales/wines/export - 와인리스트 엑셀 (세일즈). 세일즈 로그인이면 누구나 사용.
// 어드민 export와 동일 로직(lib 공용). 기본 가격대별 최소재고 적용(파라미터로 덮어쓰기 가능).
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { supabase } from '@/app/lib/db';
import { generateWineListExcel, DEFAULT_WINE_MIN_STOCK } from '@/app/lib/wineListExcel';

function parseMinStock(raw: string | null): Record<string, number> | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const pick: Record<string, number> = {};
    for (const k of ['u20k', 'u50k', 'u100k', 'u200k', 'over']) {
      const v = Math.round(Number(o[k]));
      if (Number.isFinite(v) && v > 0) pick[k] = v;
    }
    return Object.keys(pick).length ? pick : null;
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

    const url = new URL(request.url);
    // 최소재고: 쿼리 파라미터 우선 → 계정 저장값 → 기본값
    let savedMinStock: Record<string, number> | null = null;
    const { data: pref } = await supabase.from('user_preferences')
      .select('value').eq('manager', session.manager).eq('key', 'wineList.minStock').maybeSingle();
    if (pref?.value && typeof pref.value === 'object') savedMinStock = pref.value as Record<string, number>;

    const buffer = await generateWineListExcel({
      search: url.searchParams.get('search') || '',
      country: url.searchParams.get('country') || '',
      hideZero: url.searchParams.get('hideZero') === '1',
      minStock: parseMinStock(url.searchParams.get('minStock')) ?? savedMinStock ?? DEFAULT_WINE_MIN_STOCK,
    });
    const today = new Date().toISOString().slice(0, 10);
    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="wine-list_${today}.xlsx"`,
      },
    });
  } catch (e) {
    console.error('[SalesWineExport]', e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
