import { supabase } from "@/app/lib/db";

const COUNTRY_MAP: Record<string, string> = {
  '프랑스': '프랑스 France', '이탈리아': '이탈리아 Italy', '칠레': '칠레 Chile',
  '포르투갈': '포르투갈 Portugal', '호주': '호주 Australia', '미국': '미국 USA',
  '뉴질랜드': '뉴질랜드 New Zealand', '스페인': '스페인 Spain',
  '아르헨티나': '아르헨티나 Argentina', '독일': '독일 Germany',
};

const STOP_WORDS = new Set([
  'Saint', 'Les', 'Grand', 'Premier', 'Cru', 'Villages', 'Côtes', 'Cotes',
  'Haut', 'Côte', 'Blanc', 'Blancs', 'Muscat', 'Château', 'Pape', 'Joseph', 'Grillet',
]);

const EXTRA_KEYWORDS: Record<string, string[]> = {
  'Meursault': ['Mersault'],
  'Bourgogne': ['Burgundy', 'Aligote', 'Monthelie', 'Auxerre'],
  'Barossa': ['Barossa Valley'],
  'Rhône': ['Rhone'],
  'Châteauneuf': ['Chateauneuf'],
  'Côte': ['Cote'],
  'Côtes': ['Cotes'],
};

const deaccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

export async function expandRegionKeywords(
  regionSearch: string,
  country: string | null | undefined,
  isSubRegion: boolean,
): Promise<string[]> {
  const searchTerms = regionSearch.split(',').map((k) => k.trim());

  if (isSubRegion) {
    return searchTerms;
  }

  const regionCountry = (country && COUNTRY_MAP[country]) || country || '';
  const { data: wineRegions } = await supabase
    .from('wine_regions')
    .select('major_region, sub_region, appellation')
    .eq('country', regionCountry);

  const matchedMajors = new Set<string>();
  for (const wr of wineRegions || []) {
    for (const term of searchTerms) {
      if (wr.major_region && (wr.major_region.includes(term) || term.includes(wr.major_region.split(' ')[0]))) {
        matchedMajors.add(wr.major_region);
      }
    }
  }

  const allKeywords = new Set<string>(searchTerms);
  for (const wr of wineRegions || []) {
    if (matchedMajors.has(wr.major_region)) {
      if (wr.sub_region) {
        const parts = wr.sub_region.split(/[\s-]+/);
        for (const p of parts) {
          const cleaned = p.replace(/[^A-Za-zÀ-ÿ]/g, '');
          if (cleaned.length > 3 && /[A-Za-z]/.test(cleaned) && !STOP_WORDS.has(cleaned)) {
            allKeywords.add(cleaned);
          }
        }
      }
    }
  }

  for (const [key, extras] of Object.entries(EXTRA_KEYWORDS)) {
    if (allKeywords.has(key)) {
      for (const e of extras) allKeywords.add(e);
    }
  }

  // 모든 키워드에 대해 악센트 제거 버전도 추가
  const withDeaccent = [...allKeywords].map(k => deaccent(k)).filter(k => k.length > 3);
  for (const k of withDeaccent) allKeywords.add(k);

  return [...allKeywords];
}
