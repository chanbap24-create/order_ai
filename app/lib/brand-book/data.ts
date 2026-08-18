// 브랜드북 데이터 조립 — 세일즈 와인리스트 옵션(가격대별 최소재고 등)과 동일한 선별 규칙을
// 공유(selectWineListWines)하고, 브랜드 자료실 소개와 함께 묶는다.
import { supabase } from '@/app/lib/db';
import { flavorLabel } from '@/app/api/sales/recommend/lib/flavor';
import { vintageFromCode } from '@/app/sales/recommend/lib/quoteImage';
import { selectWineListWines } from '@/app/lib/wineListExcel';

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

// 원본 브랜드북의 국가 순서 관례
const COUNTRY_ORDER = ['프랑스', '이탈리아', '스페인', '포르투갈', '독일', '미국', '칠레', '아르헨티나', '호주', '뉴질랜드', '영국'];
const countryRank = (c: string) => {
  const idx = COUNTRY_ORDER.indexOf(c);
  return idx === -1 ? 99 : idx;
};

export async function buildBrandBookData(opts?: { minStock?: Record<string, number> | null }): Promise<BookBrand[]> {
  // 1) 와인리스트와 동일한 선별 규칙 — 검색·비상품·공급가·실재고·가격대별 최소재고(세일즈 옵션)
  const listed = await selectWineListWines({ hideZero: true, minStock: opts?.minStock ?? null });
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
        country: b?.country || String(w.country || ''),
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
  // 정렬: 국가 → 브랜드명 / 브랜드 안에서는 가격 내림차순
  for (const g of list) g.wines.sort((a, b) => b.supply_price - a.supply_price);
  list.sort((a, b) =>
    countryRank(a.country) - countryRank(b.country)
    || a.country.localeCompare(b.country, 'ko')
    || a.name_kr.localeCompare(b.name_kr, 'ko'));
  return list;
}
