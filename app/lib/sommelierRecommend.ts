// 백화점 손님 취향 문답 → 매장 재고 와인 추천 스코어링 (서버 전용).
// 풀 = 선택한 백화점 매장에 재고가 있고 판매가(retail_price) 있는 와인.
// 점수 = 향미 겹침 + 바디 + 재고 가점. 국가 선택은 하드게이트(부족 시 타국 보충).
import { supabase } from './db';
import { FLAVOR_KO } from '@/app/api/sales/recommend/lib/flavor';
import { COUNTRY_OPTIONS, FLAVOR_GROUPS, STORES, normalizeWineType, type QuizAnswers } from '@/app/sommelier/lib/quiz';

export type SommelierResult = {
  item_code: string;
  name: string;
  name_en: string;
  country: string;
  region: string;
  retail_price: number;
  stock: number;       // 해당 매장(또는 전 매장 합) 재고
  flavors: string[];   // 한글 라벨 (최대 5)
  reason: string;      // 매칭 이유 한 줄 (직원 설명 대본)
  body: number;        // 구조 프로파일 1~5 (조사값, 없으면 추정)
  tannin: number;
  acidity: number;
  sweetness: number;
  score: number;
};

type Note = { flavor_tags: string[]; body: number | null; sweetness: number | null; acidity: number | null; tannin: number | null };
type PoolWine = {
  item_code: string; name: string; name_en: string; country: string; region: string;
  type: string; grapes: string; retail: number; stock: number; tags: string[]; note: Note | null;
};

const STORE_COLS = ['store_hyundai_main', 'store_hyundai_jungdong', 'store_hyundai_trade', 'store_ssg_gangnam', 'store_thehyundai'];
// 와인 품번만: 0~5(샴페인·스파클링·레드·화이트·로제·아이스와인)·A(포트) + ZK(타사 와인).
// 글라스(D·RD)·자재(8,9)·세트(7) 등 비와인 제외.
const WINE_CODE = /^([0-5A]|ZK)/i;
const NON_WINE_NAME = /글라스|잔\b|디캔터|오프너|스토퍼|더미|케이스|쇼핑백|지함|버켓|버킷|코스터|박스|텀블러|철제|집기|쿨러|디스플레이/i;

/** 백화점 매장 재고(dept_store_stock) 기반 와인 풀 로드 (1000행 캡 페이지네이션).
 *  가격 = 판매가 우선, 없으면(타사 위탁 등) 공급가 폴백. */
async function loadPool(store: string): Promise<PoolWine[]> {
  const storeCol = store !== 'all' && STORES[store] ? store : null;
  const inv: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from('dept_store_stock')
      .select(`item_no, retail_price, supply_price, ${STORE_COLS.join(', ')}`);
    q = storeCol ? q.gt(storeCol, 0) : q;
    const { data } = await q.range(from, from + 999);
    inv.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const rows = inv
    .map((r) => ({
      code: String(r.item_no),
      retail: (Number(r.retail_price) || 0) > 0 ? Number(r.retail_price) : Number(r.supply_price) || 0,
      stock: storeCol
        ? Number(r[storeCol]) || 0
        : STORE_COLS.reduce((s, c) => s + (Number(r[c]) || 0), 0),
    }))
    .filter((r) => r.stock > 0 && r.retail > 0 && WINE_CODE.test(r.code));

  const codes = rows.map((r) => r.code);
  const wines = new Map<string, { item_name_kr: string; item_name_en: string; country: string; region: string; wine_type: string; grape_varieties: string }>();
  const notes = new Map<string, Note>();
  for (let i = 0; i < codes.length; i += 400) {
    const batch = codes.slice(i, i + 400);
    const [{ data: ws }, { data: ns }] = await Promise.all([
      supabase.from('wines').select('item_code, item_name_kr, item_name_en, country, region, wine_type, grape_varieties').in('item_code', batch),
      supabase.from('tasting_notes').select('wine_id, flavor_tags, body, sweetness, acidity, tannin').in('wine_id', batch),
    ]);
    for (const w of ws || []) wines.set(w.item_code, w);
    for (const n of ns || []) notes.set(n.wine_id, { ...n, flavor_tags: (n.flavor_tags || []) as string[] });
  }
  return rows.flatMap((r) => {
    const w = wines.get(r.code);
    if (!w || !w.item_name_kr) return [];
    if (NON_WINE_NAME.test(w.item_name_kr)) return [];
    const note = notes.get(r.code) || null;
    return [{
      item_code: r.code,
      name: w.item_name_kr, name_en: w.item_name_en || '',
      country: w.country || '', region: w.region || '',
      type: normalizeWineType(w.wine_type || ''),
      grapes: (w.grape_varieties || '').toLowerCase(),
      retail: r.retail, stock: r.stock,
      tags: note?.flavor_tags || [],
      note,
    }];
  });
}

// 품종 기반 바디 근사 — 조사값·향미 태그가 없는 와인 폴백
const FULL_GRAPES = ['cabernet', 'syrah', 'shiraz', 'malbec', 'zinfandel', 'mourvedre', 'petite sirah', 'nebbiolo', 'aglianico', 'touriga', '카베르네', '시라', '쉬라즈', '말벡', '네비올로'];
const LIGHT_GRAPES = ['pinot noir', 'gamay', 'riesling', 'sauvignon blanc', 'albarino', 'albariño', 'pinot grigio', 'pinot gris', 'vinho verde', '피노 누아', '피노누아', '가메', '리슬링', '소비뇽'];

function bodyOf(w: PoolWine): 'full' | 'light' | '' {
  const b = w.note?.body;
  if (b != null) return b >= 4 ? 'full' : b <= 2 ? 'light' : '';
  if (w.tags.includes('full_body') || w.tags.includes('tannic')) return 'full';
  if (w.tags.includes('light_body')) return 'light';
  if (FULL_GRAPES.some((g) => w.grapes.includes(g))) return 'full';
  if (LIGHT_GRAPES.some((g) => w.grapes.includes(g))) return 'light';
  return '';
}

/** 표시용 구조 프로파일 — 조사값 우선, 없으면 타입·태그로 추정 */
function structureOf(w: PoolWine): { body: number; tannin: number; acidity: number; sweetness: number } {
  const est = bodyOf(w);
  const body = w.note?.body ?? (est === 'full' ? 4 : est === 'light' ? 2 : 3);
  const tannin = w.note?.tannin
    ?? (w.type === 'red' ? (w.tags.includes('tannic') ? 4 : 3) : 1);
  const acidity = w.note?.acidity
    ?? (w.type === 'white' || w.type === 'sparkling' ? 4 : w.tags.includes('light_body') ? 4 : 3);
  const sweet = /모스카토|moscato|아이스바인|eiswein|소테른|sauternes/i.test(w.name + ' ' + w.name_en);
  const sweetness = w.note?.sweetness ?? (w.type === 'fortified' || sweet ? 4 : 1);
  return { body, tannin, acidity, sweetness };
}

function scoreWine(w: PoolWine, a: QuizAnswers): { score: number; matched: string[] } {
  let score = 0;
  const wanted = new Set(a.flavorGroups.flatMap((g) => FLAVOR_GROUPS[g]?.keys || []));
  const matched = w.tags.filter((t) => wanted.has(t));
  score += Math.min(40, matched.length * 8);
  const body = bodyOf(w);
  if (a.body === 'light') score += body === 'light' ? 15 : body === 'full' ? -8 : 0;
  else if (a.body === 'full') score += body === 'full' ? 15 : body === 'light' ? -8 : 0;
  else if (a.body === 'medium') score += body === '' ? 8 : 3;
  if (w.stock >= 6) score += 3;
  return { score, matched };
}

function countryHit(w: PoolWine, a: QuizAnswers): boolean {
  const c = w.country.toLowerCase();
  return a.countries.some((k) => (COUNTRY_OPTIONS[k]?.match || []).some((m) => c.includes(m)));
}

function buildReason(w: PoolWine, a: QuizAnswers, matched: string[]): string {
  const parts: string[] = [];
  if (matched.length) parts.push(`${matched.slice(0, 3).map((k) => FLAVOR_KO[k] || k).join('·')} 향`);
  const body = bodyOf(w);
  if (a.body === 'light' && body === 'light') parts.push('가볍고 산뜻한 스타일');
  else if (a.body === 'full' && body === 'full') parts.push('진하고 묵직한 스타일');
  if (a.countries.length && countryHit(w, a)) parts.push(`선호하신 ${w.country} 와인`);
  return parts.join(' · ') || '취향 조건에 맞는 와인';
}

/** 문답 결과로 매장 재고 와인 추천 top N. 국가 선택은 순수 하드게이트(보충 없음). */
export async function recommendForCustomer(a: QuizAnswers, limit = 5, store = 'all'): Promise<SommelierResult[]> {
  const pool = await loadPool(store);
  const filtered = pool.filter((w) => {
    // Sweet = 타입이 아니라 당도 기반(조사값 또는 추정 3 이상) — 디저트·모스카토·주정강화 포함
    if (a.type === 'sweet') {
      if (structureOf(w).sweetness < 3) return false;
    } else if (a.type && w.type !== a.type) return false;
    if (a.priceMin != null && w.retail < a.priceMin) return false;
    if (a.priceMax != null && w.retail > a.priceMax) return false;
    if (a.countries.length && !countryHit(w, a)) return false; // 국가 하드게이트
    return true;
  });
  const picked = filtered
    .map((w) => ({ w, ...scoreWine(w, a) }))
    .sort((x, y) => y.score - x.score || x.w.retail - y.w.retail)
    .slice(0, limit);

  return picked.map(({ w, score, matched }) => ({
    item_code: w.item_code,
    name: w.name, name_en: w.name_en,
    country: w.country, region: w.region,
    retail_price: w.retail, stock: w.stock,
    flavors: w.tags.slice(0, 5).map((k) => FLAVOR_KO[k] || k),
    reason: buildReason(w, a, matched),
    ...structureOf(w),
    score,
  }));
}
