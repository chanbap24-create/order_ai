// 프로모션 상세페이지 데이터 조립 — 활성 프로모션(CDV) + 와인 메타 + 향미 요약.
// /promo (공개 마케팅 페이지)와 이미지 프록시가 사용. 프로모션만 바꾸면 페이지가 자동 갱신된다.
import { supabase } from './db';
import { flavorLabel } from '@/app/api/sales/recommend/lib/flavor';
import { roundTo100 } from './priceUtils';

export interface PromoPageItem {
  item_no: string;
  name_kr: string;
  name_en: string;
  country: string;
  region: string;
  flavors: string[];       // 한글 향미 상위 5
  supply_price: number;    // 정상 공급가
  promo_price: number;     // 프로모션가
  quantity: number | null; // 조건 수량(있으면)
  memo: string;
  has_image: boolean;      // 병샷 유무 (프록시 경로 사용 여부)
}

export interface PromoPageData {
  month: string; // '2026년 7월'
  items: PromoPageItem[];
}

export async function getPromoPageData(): Promise<PromoPageData> {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  const month = `${kst.getUTCFullYear()}년 ${kst.getUTCMonth() + 1}월`;

  const { data: promos } = await supabase
    .from('promotions')
    .select('item_no, item_name, quantity, discount_rate, discount_price, memo')
    .eq('corporation', 'CDV')
    .eq('active', true)
    .eq('page_visible', true) // 상세페이지 노출로 선택된 것만
    .order('created_at', { ascending: true });
  const rows = promos || [];
  if (rows.length === 0) return { month, items: [] };

  const codes = rows.map((p) => p.item_no);
  const { data: wines } = await supabase
    .from('wines')
    .select('item_code, item_name_kr, item_name_en, country, region, image_url, supply_price')
    .in('item_code', codes);
  const wmap = new Map((wines || []).map((w) => [w.item_code, w]));

  const { data: notes } = await supabase
    .from('tasting_notes')
    .select('wine_id, flavor_tags')
    .in('wine_id', codes);
  const fmap = new Map((notes || []).map((n) => [n.wine_id, (n.flavor_tags || []) as string[]]));

  // 공급가는 재고 엑셀(inventory_cdv) 우선 — wines.supply_price 는 구값일 수 있음
  const { data: inv } = await supabase
    .from('inventory_cdv')
    .select('item_no, supply_price')
    .in('item_no', codes);
  const imap = new Map((inv || []).map((r) => [r.item_no, Number(r.supply_price) || 0]));

  const items: PromoPageItem[] = rows.map((p) => {
    const w = wmap.get(p.item_no);
    const supply = imap.get(p.item_no) || Number(w?.supply_price) || 0;
    const promo = Number(p.discount_price) > 0
      ? Number(p.discount_price)
      : roundTo100(supply * (1 - (Number(p.discount_rate) || 0)));
    return {
      item_no: p.item_no,
      name_kr: w?.item_name_kr || p.item_name || p.item_no,
      name_en: w?.item_name_en || '',
      country: w?.country || '',
      region: w?.region || '',
      flavors: (fmap.get(p.item_no) || []).slice(0, 5).map((k) => flavorLabel(k)),
      supply_price: supply,
      promo_price: promo,
      quantity: p.quantity || null,
      memo: p.memo || '',
      has_image: !!w?.image_url,
    };
  });

  return { month, items };
}

/** 이미지 프록시용 — 활성 프로모션 품목일 때만 image_url 반환(SSRF 방지: 품번 키로만 조회). */
export async function getPromoImageUrl(itemNo: string): Promise<string | null> {
  const { data: p } = await supabase
    .from('promotions')
    .select('item_no')
    .eq('corporation', 'CDV').eq('active', true).eq('item_no', itemNo)
    .maybeSingle();
  if (!p) return null;
  const { data: w } = await supabase
    .from('wines').select('image_url').eq('item_code', itemNo).maybeSingle();
  const url = w?.image_url || '';
  return /^https?:\/\//.test(url) ? url : null;
}
