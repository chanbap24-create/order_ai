// 백화점 손님 취향 문답 → 재고 와인 추천 스코어링 (서버 전용).
// 풀 = CDV 가용재고 있고 판매가(retail_price) 있는 와인. 점수 = 향미 겹침 + 바디 + 용도 가점.
import { supabase } from './db';
import { FLAVOR_KO } from '@/app/api/sales/recommend/lib/flavor';
import { FLAVOR_GROUPS, normalizeWineType, type QuizAnswers } from '@/app/sommelier/lib/quiz';

export type SommelierResult = {
  item_code: string;
  name: string;
  name_en: string;
  country: string;
  region: string;
  retail_price: number;
  stock: number;
  flavors: string[]; // 한글 라벨 (최대 5)
  reason: string;    // 매칭 이유 한 줄 (직원 설명 대본)
  score: number;
};

type PoolWine = {
  item_code: string; name: string; name_en: string; country: string; region: string;
  type: string; retail: number; stock: number; tags: string[];
};

/** CDV 재고 + 판매가 있는 와인 풀 로드 (1000행 캡 페이지네이션) */
async function loadPool(): Promise<PoolWine[]> {
  const inv: { item_no: string; retail_price: number; available_stock: number }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from('inventory_cdv').select('item_no, retail_price, available_stock')
      .gt('available_stock', 0).gt('retail_price', 0).range(from, from + 999);
    inv.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const codes = inv.map((r) => r.item_no);
  const wines = new Map<string, { item_name_kr: string; item_name_en: string; country: string; region: string; wine_type: string }>();
  const tags = new Map<string, string[]>();
  for (let i = 0; i < codes.length; i += 400) {
    const batch = codes.slice(i, i + 400);
    const [{ data: ws }, { data: ns }] = await Promise.all([
      supabase.from('wines').select('item_code, item_name_kr, item_name_en, country, region, wine_type').in('item_code', batch),
      supabase.from('tasting_notes').select('wine_id, flavor_tags').in('wine_id', batch),
    ]);
    for (const w of ws || []) wines.set(w.item_code, w);
    for (const n of ns || []) tags.set(n.wine_id, (n.flavor_tags || []) as string[]);
  }
  return inv.flatMap((r) => {
    const w = wines.get(r.item_no);
    if (!w || !w.item_name_kr) return [];
    return [{
      item_code: r.item_no,
      name: w.item_name_kr, name_en: w.item_name_en || '',
      country: w.country || '', region: w.region || '',
      type: normalizeWineType(w.wine_type || ''),
      retail: r.retail_price, stock: r.available_stock,
      tags: tags.get(r.item_no) || [],
    }];
  });
}

const FAMOUS = ['champagne', 'bourgogne', 'burgundy', 'bordeaux', 'napa', 'barolo', 'montalcino', 'toscana', 'tuscany', '샴페인', '부르고뉴', '보르도', '나파'];

function scoreWine(w: PoolWine, a: QuizAnswers): { score: number; matched: string[] } {
  let score = 0;
  // 향미 겹침 — 선택 그룹의 키 ∩ 와인 태그, 히트당 8점(상한 40)
  const wanted = new Set(a.flavorGroups.flatMap((g) => FLAVOR_GROUPS[g]?.keys || []));
  const matched = w.tags.filter((t) => wanted.has(t));
  score += Math.min(40, matched.length * 8);
  // 바디
  const hasFull = w.tags.includes('full_body') || w.tags.includes('tannic');
  const hasLight = w.tags.includes('light_body');
  if (a.body === 'light') score += hasLight ? 15 : hasFull ? -8 : 0;
  else if (a.body === 'full') score += hasFull ? 15 : hasLight ? -8 : 0;
  else if (a.body === 'medium') score += !hasFull && !hasLight ? 8 : 3;
  // 용도
  const regionLc = `${w.country} ${w.region}`.toLowerCase();
  if (a.occasion === 'gift') {
    if (w.retail >= 50000) score += 8;
    if (FAMOUS.some((f) => regionLc.includes(f))) score += 6;
  } else if (a.occasion === 'special') {
    if (w.type === 'sparkling') score += 12;
    if (w.retail >= 70000) score += 4;
  } else if (a.occasion === 'casual') {
    if (w.retail <= 50000) score += 8;
    if (hasLight) score += 4;
  } else if (a.occasion === 'meal') {
    if (hasFull) score += 6;
  }
  // 재고 여유 소폭 가점(품절 위험 회피)
  if (w.stock >= 6) score += 3;
  return { score, matched };
}

function buildReason(w: PoolWine, a: QuizAnswers, matched: string[]): string {
  const parts: string[] = [];
  if (matched.length) parts.push(`${matched.slice(0, 3).map((k) => FLAVOR_KO[k] || k).join('·')} 향`);
  if (a.body === 'light' && w.tags.includes('light_body')) parts.push('가볍고 산뜻한 스타일');
  else if (a.body === 'full' && (w.tags.includes('full_body') || w.tags.includes('tannic'))) parts.push('진하고 묵직한 스타일');
  if (a.occasion === 'gift') parts.push('선물용으로 인기');
  else if (a.occasion === 'special' && w.type === 'sparkling') parts.push('축하 자리에 어울리는 스파클링');
  else if (a.occasion === 'meal') parts.push('음식과 잘 어울림');
  else if (a.occasion === 'casual') parts.push('부담 없이 즐기기 좋음');
  return parts.join(' · ') || '취향 조건에 맞는 재고 와인';
}

/** 문답 결과로 재고 와인 추천 top N */
export async function recommendForCustomer(a: QuizAnswers, limit = 5): Promise<SommelierResult[]> {
  const pool = await loadPool();
  const filtered = pool.filter((w) => {
    if (a.type && w.type !== a.type) return false;
    if (a.priceMin != null && w.retail < a.priceMin) return false;
    if (a.priceMax != null && w.retail > a.priceMax) return false;
    return true;
  });
  const scored = filtered
    .map((w) => ({ w, ...scoreWine(w, a) }))
    .sort((x, y) => y.score - x.score || x.w.retail - y.w.retail)
    .slice(0, limit);
  return scored.map(({ w, score, matched }) => ({
    item_code: w.item_code,
    name: w.name, name_en: w.name_en,
    country: w.country, region: w.region,
    retail_price: w.retail, stock: w.stock,
    flavors: w.tags.slice(0, 5).map((k) => FLAVOR_KO[k] || k),
    reason: buildReason(w, a, matched),
    score,
  }));
}
