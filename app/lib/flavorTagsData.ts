// 향미태그 브라우저용 데이터: 조사된 와인(flavor_tags 있음) + 메타 + 한글 향미 라벨.
import { supabase } from '@/app/lib/db';
import { flavorLabel } from '@/app/api/sales/recommend/lib/flavor';

export type FlavorWine = {
  code: string;
  name: string;
  type: string;
  country: string;
  price: number;
  tags: string[]; // 한글 향미 라벨
};

/** flavor_tags 있는 와인 전체를 이름순으로. 향미 키는 한글 라벨로 변환. */
export async function getFlavorTagsData(): Promise<FlavorWine[]> {
  const notes = (await supabase
    .from('tasting_notes')
    .select('wine_id, flavor_tags')
    .not('flavor_tags', 'is', null)).data as Array<{ wine_id: string; flavor_tags: string[] | null }> || [];
  const withTags = notes.filter((n) => n.flavor_tags && n.flavor_tags.length);
  const codes = withTags.map((n) => n.wine_id);

  const wmap = new Map<string, { item_name_kr?: string; wine_type?: string; country?: string; supply_price?: number }>();
  for (let i = 0; i < codes.length; i += 300) {
    const w = (await supabase
      .from('wines')
      .select('item_code, item_name_kr, wine_type, country, supply_price')
      .in('item_code', codes.slice(i, i + 300))).data as Array<{ item_code: string } & Record<string, unknown>> || [];
    for (const x of w) wmap.set(x.item_code, x as never);
  }

  return withTags
    .map((n) => {
      const w = wmap.get(n.wine_id) || {};
      return {
        code: n.wine_id,
        name: w.item_name_kr || n.wine_id,
        type: w.wine_type || '',
        country: w.country || '',
        price: Number(w.supply_price) || 0,
        tags: (n.flavor_tags || []).map((k) => flavorLabel(k)),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}
