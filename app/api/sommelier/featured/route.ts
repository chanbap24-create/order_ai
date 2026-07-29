// 인트로 순환용 병샷 후보 — 선택 매장에 재고가 있고 병 이미지가 있는 와인 목록(셔플).
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { supabase } from '@/app/lib/db';
import { handleApiError } from '@/app/lib/errors';
import { STORE_COLS } from '@/app/lib/deptStoreStock';
import { STORES } from '@/app/sommelier/lib/quiz';
import { cacheVer } from '@/app/lib/cacheVer';

const WINE_CODE = /^([0-5A]|ZK)/i;
// "사실상 있는 재고"만 노출: 고가(10만↑)는 1병도 진짜 재고, 저가는 3병 이상 + 최근 한 달 출고 있어야
const PREMIUM_PRICE = 100000;
const MIN_STOCK_CHEAP = 3;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  try {
    const store = req.nextUrl.searchParams.get('store') || 'all';
    const storeCol = store !== 'all' && STORES[store] ? store : null;
    const cand: { code: string; stock: number; price: number }[] = [];
    for (let from = 0; ; from += 1000) {
      let q = supabase.from('dept_store_stock')
        .select(`item_no, retail_price, supply_price, ${STORE_COLS.join(', ')}`);
      if (storeCol) q = q.gt(storeCol, 0);
      const { data } = await q.range(from, from + 999);
      for (const r of (data || []) as Record<string, unknown>[]) {
        const code = String(r.item_no);
        const stock = storeCol
          ? Number(r[storeCol]) || 0
          : STORE_COLS.reduce((sum, c) => sum + (Number(r[c]) || 0), 0);
        const price = (Number(r.retail_price) || 0) > 0 ? Number(r.retail_price) : Number(r.supply_price) || 0;
        if (stock > 0 && WINE_CODE.test(code)) cand.push({ code, stock, price });
      }
      if (!data || data.length < 1000) break;
    }
    // 저가 판단용 최근 30일 출고량 (일일 재고표 기준 — 없는 품목은 판단 불가로 통과)
    const sales = new Map<string, number>();
    for (let i = 0; i < cand.length; i += 500) {
      const { data: inv } = await supabase.from('inventory_cdv')
        .select('item_no, sales_30days').in('item_no', cand.slice(i, i + 500).map((c) => c.code));
      for (const r of inv || []) sales.set(r.item_no, Number(r.sales_30days) || 0);
    }
    const codes = cand.filter((c) => {
      if (c.price >= PREMIUM_PRICE) return c.stock >= 1;          // 고가: 1병도 진짜 재고
      if (c.stock < MIN_STOCK_CHEAP) return false;                 // 저가: 최소 3병
      const s30 = sales.get(c.code);
      return s30 === undefined || s30 > 0;                         // 저가: 한 달 출고 있어야(미상은 통과)
    }).map((c) => c.code);
    const withImage: { code: string; name: string; name_en: string; v: string }[] = [];
    for (let i = 0; i < codes.length; i += 500) {
      const { data: ws } = await supabase
        .from('wines').select('item_code, item_name_kr, item_name_en, image_url').in('item_code', codes.slice(i, i + 500))
        .not('image_url', 'is', null);
      for (const w of ws || []) {
        if (/^https?:\/\//.test(w.image_url || '')) {
          withImage.push({ code: w.item_code, name: w.item_name_kr || '', name_en: w.item_name_en || '', v: cacheVer(w.image_url || '') });
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
