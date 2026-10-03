// 와인 산지 → 손님 취향 표시용 큰 산지명(한글). '볼네·포마르·상트네' → 부르고뉴, 'Luberon, Rhône Valley' → 론.
// 판정은 추천 엔진의 산지 계층 매칭(findHierarchy + wine_regions)을 그대로 쓴다 — 복제 금지.
// 프랑스는 광역(부르고뉴·보르도…), 그 외 국가는 대지역(토스카나·나파…가 속한 주/지역) 한글명.
import { supabase } from './db';
import { fetchAllRows } from './fetchAll';
import { findHierarchy, type WineRegionRow } from '@/app/api/sales/recommend/lib/regions';

const SUPER_KO: Record<string, string> = {
  Burgundy: '부르고뉴', Bordeaux: '보르도', Champagne: '샹파뉴', 'Rhône': '론', Loire: '루아르', Alsace: '알자스',
  'Languedoc-Roussillon': '랑그독·루시용', Provence: '프로방스', 'Jura-Savoie': '쥐라·사부아', 'Sud-Ouest': '남서부', Corsica: '코르시카',
};

/** '토스카나 Toscana' → '토스카나'. 한글이 없으면 원문 */
const koreanPart = (bilingual: string) => bilingual.split(/\s+(?=[A-Za-zÀ-ÿ])/)[0].trim() || bilingual;

export type RegionGrouper = (region: string | null, name: string | null, country: string | null) => string;

/** wine_regions를 한 번 읽어 판정 함수를 돌려준다(엑셀·관리자·단골 카드 공용). 못 찾으면 '' */
export async function loadRegionGrouper(): Promise<RegionGrouper> {
  const rows = await fetchAllRows<WineRegionRow>((f, t) =>
    supabase.from('wine_regions').select('country, major_region, sub_region, appellation, cru_vineyard, classification').range(f, t));
  return (region, name, country) => {
    if (!region && !name) return '';
    const h = findHierarchy(region || '', name || '', rows, country || '');
    if (!h) return '';
    if (h.super_region) return SUPER_KO[h.super_region] || h.super_region;
    return h.major_region ? koreanPart(h.major_region) : '';
  };
}
