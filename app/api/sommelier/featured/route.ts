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

// 매장별 후보 캐시 — 재고표는 하루 단위 갱신이라 짧은 TTL로 충분. 셔플은 요청마다 새로.
type Item = { code: string; name: string; name_en: string; v: string; logo?: string };
const cache = new Map<string, { t: number; items: Item[] }>();
const CACHE_TTL = 10 * 60_000;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  try {
    const store = req.nextUrl.searchParams.get('store') || 'all';
    const storeCol = store !== 'all' && STORES[store] ? store : null;
    const hit = cache.get(store);
    const pool = hit && Date.now() - hit.t < CACHE_TTL ? hit.items : null;
    if (pool) {
      const a = [...pool];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return NextResponse.json({ items: a.slice(0, 12) });
    }
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
    // 최근 30일 출고량 (일일 재고표 기준)
    const sales = new Map<string, number>();
    for (let i = 0; i < cand.length; i += 500) {
      const { data: inv } = await supabase.from('inventory_cdv')
        .select('item_no, sales_30days').in('item_no', cand.slice(i, i + 500).map((c) => c.code));
      for (const r of inv || []) sales.set(r.item_no, Number(r.sales_30days) || 0);
    }
    const codes = cand.filter((c) => {
      // 30일 출고가 확인된 와인만 — 일일 재고표에 없는 백화점 전용 품목(미상)도 제외
      // (영업 재고 0인 와인이 인트로에 떠서 '재고 없는 이상한 와인'으로 보이던 문제)
      if (!(sales.get(c.code)! > 0)) return false;
      if (c.price >= PREMIUM_PRICE) return c.stock >= 1;           // 고가: 1병도 진짜 재고
      return c.stock >= MIN_STOCK_CHEAP;                           // 저가: 최소 3병
    }).map((c) => c.code);
    const withImage: Item[] = [];
    const brandOf = new Map<string, string>();
    for (let i = 0; i < codes.length; i += 500) {
      const { data: ws } = await supabase
        .from('wines').select('item_code, item_name_kr, item_name_en, image_url, image_px, brand').in('item_code', codes.slice(i, i + 500))
        .not('image_url', 'is', null)
        .gte('image_px', 700); // 인트로는 크게 확대되므로 고해상 이미지만(저해상은 흐릿)
      for (const w of ws || []) {
        if (/^https?:\/\//.test(w.image_url || '')) {
          withImage.push({ code: w.item_code, name: w.item_name_kr || '', name_en: w.item_name_en || '', v: cacheVer(w.image_url || '') });
          if (w.brand) brandOf.set(w.item_code, String(w.brand).toUpperCase());
        }
      }
    }
    // 와이너리 로고 (브랜드 자료실) — 있으면 캡션에 함께 표시
    const { data: bs } = await supabase.from('brands').select('brand_code, logo_url').not('logo_url', 'is', null);
    const logoBy = new Map((bs || []).map((b) => [String(b.brand_code || '').toUpperCase(), String(b.logo_url)]));
    for (const it of withImage) {
      const logo = logoBy.get(brandOf.get(it.code) || '');
      if (logo && /^https?:\/\//.test(logo)) it.logo = logo;
    }
    cache.set(store, { t: Date.now(), items: [...withImage] });
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
