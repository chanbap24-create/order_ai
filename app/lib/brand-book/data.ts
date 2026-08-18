// 브랜드북 데이터 조립 — 세일즈 와인리스트 옵션(가격대별 최소재고 등)과 동일한 선별 규칙을
// 공유(selectWineListWines)하고, 브랜드 자료실 소개와 함께 묶는다.
import { supabase } from '@/app/lib/db';
import { flavorLabel } from '@/app/api/sales/recommend/lib/flavor';
import { vintageFromCode } from '@/app/sales/recommend/lib/quoteImage';
import { selectWineListWines, WINE_LIST_BRAND_ORDER, WINE_LIST_COUNTRY_ORDER } from '@/app/lib/wineListExcel';

// 국가 표기 정규화 — 자료실 혼용(United States/USA/미국 등) 통일. 미국권은 'USA'로 표기.
const NORM_COUNTRY: Record<string, string> = {
  'United States': 'USA', '미국': 'USA', USA: 'USA',
  France: '프랑스', Italy: '이탈리아', 이태리: '이탈리아', Spain: '스페인', Portugal: '포르투갈',
  Germany: '독일', Chile: '칠레', Argentina: '아르헨티나', Australia: '호주',
  'New Zealand': '뉴질랜드', NewZealand: '뉴질랜드', England: '영국',
};
const normCountry = (c: string) => NORM_COUNTRY[c.trim()] || c.trim();

export interface BookWine {
  item_code: string;
  name_kr: string;
  name_en: string;
  vintage: string;
  region: string;
  grapes: string;
  supply_price: number;
  image_url: string | null;
  flavors: string[];
}

export interface BookBrand {
  code: string;
  name_kr: string;
  name_en: string;
  country: string;
  region: string;
  description: string;
  logo_url: string | null;
  wines: BookWine[];
}


// 브랜드북 전용 실질 재고 하한 — 옵션 규칙과 별개로 전 가격대 공통.
// 고가 1~5병(대용량 한정판 등)은 형식상 재고일 뿐 거래처 주문을 못 받아 북에서 제외.
const MIN_BOOK_STOCK = 6;

export async function buildBrandBookData(opts?: { minStock?: Record<string, number> | null }): Promise<BookBrand[]> {
  // 1) 와인리스트와 동일한 선별 규칙 — 검색·비상품·공급가·실재고·가격대별 최소재고(세일즈 옵션)
  const listed0 = await selectWineListWines({ hideZero: true, minStock: opts?.minStock ?? null });
  const listed = listed0.filter((w) => (w.available_stock ?? 0) >= MIN_BOOK_STOCK);
  const priceOf = new Map(listed.map((w) => [w.item_code, w.supply_price || 0]));
  const stockCodes = listed.map((w) => w.item_code);

  // 2) 브랜드북용 추가 정보(품종·이미지 등) 로드
  const wines: Record<string, unknown>[] = [];
  for (let i2 = 0; i2 < stockCodes.length; i2 += 400) {
    const { data } = await supabase.from('wines')
      .select('item_code, item_name_kr, item_name_en, brand, country, region, grape_varieties, image_url, status')
      .in('item_code', stockCodes.slice(i2, i2 + 400));
    wines.push(...(data || []));
  }
  const sellable = wines.filter((w) => w.status !== 'discontinued' && w.item_name_kr);

  // 3) 향미 태그 (있으면 상위 4개)
  const flavorMap = new Map<string, string[]>();
  const codes = sellable.map((w) => String(w.item_code));
  for (let i3 = 0; i3 < codes.length; i3 += 400) {
    const { data } = await supabase.from('tasting_notes')
      .select('wine_id, flavor_tags').in('wine_id', codes.slice(i3, i3 + 400));
    for (const n of data || []) {
      if (Array.isArray(n.flavor_tags) && n.flavor_tags.length) {
        flavorMap.set(n.wine_id, n.flavor_tags.slice(0, 4).map((k: string) => flavorLabel(k)));
      }
    }
  }

  // 4) 브랜드 자료실 (단종 브랜드 제외)
  const { data: brandRows } = await supabase.from('brands')
    .select('brand_code, brand_name_kr, brand_name_en, country, region, description, book_description, logo_url, discontinued');
  const brandBy = new Map<string, NonNullable<typeof brandRows>[number]>();
  for (const b of brandRows || []) {
    if (b.brand_code) brandBy.set(String(b.brand_code).toUpperCase(), b);
  }

  // 5) 브랜드별 그룹
  const groups = new Map<string, BookBrand>();
  for (const w of sellable) {
    const code = String(w.brand || '').toUpperCase().trim();
    const b = brandBy.get(code);
    if (b?.discontinued) continue; // 단종 브랜드 통째 제외
    const key = code || '기타';
    if (!groups.has(key)) {
      groups.set(key, {
        code: key,
        name_kr: b?.brand_name_kr || (code ? code : '기타 와인'),
        name_en: b?.brand_name_en || '',
        country: normCountry(b?.country || String(w.country || '')),
        region: b?.region || '',
        // 소개글: 원본 브랜드북 전사본 우선, 없으면 브랜드 자료실 문장
        description: b?.book_description || b?.description || '',
        logo_url: b?.logo_url || null,
        wines: [],
      });
    }
    groups.get(key)!.wines.push({
      item_code: String(w.item_code),
      name_kr: String(w.item_name_kr).replace(/^[A-Za-z]{2}\s+/, ''),
      name_en: String(w.item_name_en || ''),
      vintage: vintageFromCode(String(w.item_code)),
      region: String(w.region || ''),
      grapes: String(w.grape_varieties || ''),
      supply_price: priceOf.get(String(w.item_code)) || 0,
      image_url: (w.image_url as string) || null,
      flavors: flavorMap.get(String(w.item_code)) || [],
    });
  }

  // 6) 같은 와인(빈티지 자리만 다른 품번)은 최신 빈티지 1종만 표기
  const vinRank = (v: string) => (/^\d{4}$/.test(v) ? Number(v) : 0); // NV는 연도보다 뒤
  const baseOf = (c: string) => (c.length === 7 ? c.slice(0, 2) + c.slice(4) : c);
  const list = [...groups.values()].filter((g) => g.wines.length > 0);
  for (const g of list) {
    const byBase = new Map<string, BookWine>();
    for (const w of g.wines) {
      const k = baseOf(w.item_code);
      const cur = byBase.get(k);
      if (!cur || vinRank(w.vintage) > vinRank(cur.vintage)) byBase.set(k, w);
    }
    g.wines = [...byBase.values()];
  }
  // 정렬: 와인리스트와 동일 — 국가 순번 → 브랜드 순번표 → 이름. 순번표 밖 브랜드도 자기 국가 안에 정렬.
  for (const g of list) g.wines.sort((a, b) => b.supply_price - a.supply_price);
  list.sort((a, b) =>
    (WINE_LIST_COUNTRY_ORDER[a.country] ?? 99) - (WINE_LIST_COUNTRY_ORDER[b.country] ?? 99)
    || (WINE_LIST_BRAND_ORDER[a.code] ?? 999) - (WINE_LIST_BRAND_ORDER[b.code] ?? 999)
    || a.name_kr.localeCompare(b.name_kr, 'ko'));
  return list;
}
