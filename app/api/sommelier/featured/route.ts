// 인트로 순환용 병샷 후보 — 선택 매장에 재고가 있고 병 이미지가 있는 와인 목록(셔플).
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { supabase } from '@/app/lib/db';
import { handleApiError } from '@/app/lib/errors';
import { STORE_COLS } from '@/app/lib/deptStoreStock';
import { STORES } from '@/app/sommelier/lib/quiz';

const WINE_CODE = /^([0-5A]|ZK)/i;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  try {
    const store = req.nextUrl.searchParams.get('store') || 'all';
    const storeCol = store !== 'all' && STORES[store] ? store : null;
    const codes: string[] = [];
    for (let from = 0; ; from += 1000) {
      let q = supabase.from('dept_store_stock').select(`item_no, ${STORE_COLS.join(', ')}`);
      if (storeCol) q = q.gt(storeCol, 0);
      const { data } = await q.range(from, from + 999);
      for (const r of (data || []) as Record<string, unknown>[]) {
        const code = String(r.item_no);
        const stock = storeCol
          ? Number(r[storeCol]) || 0
          : STORE_COLS.reduce((sum, c) => sum + (Number(r[c]) || 0), 0);
        if (stock > 0 && WINE_CODE.test(code)) codes.push(code);
      }
      if (!data || data.length < 1000) break;
    }
    const withImage: { code: string; name: string; name_en: string }[] = [];
    for (let i = 0; i < codes.length; i += 500) {
      const { data: ws } = await supabase
        .from('wines').select('item_code, item_name_kr, item_name_en, image_url').in('item_code', codes.slice(i, i + 500))
        .not('image_url', 'is', null);
      for (const w of ws || []) {
        if (/^https?:\/\//.test(w.image_url || '')) {
          withImage.push({ code: w.item_code, name: w.item_name_kr || '', name_en: w.item_name_en || '' });
        }
      }
    }
    // 셔플 후 12개
    for (let i = withImage.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [withImage[i], withImage[j]] = [withImage[j], withImage[i]];
    }
    return NextResponse.json({ items: withImage.slice(0, 12) });
  } catch (e) {
    return handleApiError(e);
  }
}
