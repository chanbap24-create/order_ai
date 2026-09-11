// 백화점 손님 취향 문답 → 매장 재고 와인 추천 스코어링 (서버 전용).
// 풀 = 선택한 백화점 매장에 재고가 있고 판매가(retail_price) 있는 와인.
// 점수 = 향미(취향 그룹당 1회 인정) + 바디(실측 축 거리) + 평점 자산 + 음용적기 ± 재고.
// 동점은 가격순이 아니라 평점→일자 시드 셔플(매일 로테이션). 같은 와인의 용량/포장
// 변형은 1장만, 같은 생산자는 상위권에 최대 2장(초과분은 뒤로 밀림 — 제거 아님).
import { supabase } from './db';
import { FLAVOR_KO } from '@/app/api/sales/recommend/lib/flavor';
import { COUNTRY_OPTIONS, FLAVOR_GROUPS, STORES, normalizeWineType, type QuizAnswers } from '@/app/sommelier/lib/quiz';
import { cacheVer } from './cacheVer';

export type SommelierResult = {
  item_code: string;
  name: string;
  name_en: string;
  vintage: string;
  country: string;
  region: string;
  retail_price: number;
  stock: number;       // 해당 매장(또는 전 매장 합) 재고
  flavors: string[];   // 한글 라벨 (최대 5)
  reason: string;      // 매칭 이유 한 줄 (직원 설명 대본)
  img_ver: string;     // 병샷 캐시버스트(이미지 교체 시 즉시 반영)
  body: number;        // 구조 프로파일 1~5 (조사값, 없으면 추정)
  tannin: number;
  acidity: number;
  sweetness: number;
  score: number;
  award_note: string | null;   // 평점 한 줄 (예: "James Suckling 96점")
  vintage_hint: string | null; // 빈티지 스토리 첫 문장 — 카드용 짧은 대본
  peak: 'peak' | 'past' | null; // 음용적기 상태 (vintage_note 기반)
};

type Note = { flavor_tags: string[]; body: number | null; sweetness: number | null; acidity: number | null; tannin: number | null };
type PoolWine = {
  item_code: string; name: string; name_en: string; vintage: string; country: string; region: string;
  type: string; grapes: string; retail: number; stock: number; tags: string[]; note: Note | null;
  imgVer: string;
  producer: string;          // 다양성 가드 키 (brand > supplier > 이름 첫 토큰)
  awardBonus: number;        // 평점 자산 가점 (0~10)
  awardNote: string | null;  // 평점 표시 한 줄
  peak: 'peak' | 'past' | null;
  vintageHint: string | null;
};

/** awards 텍스트 → 가점 + 표시 한 줄. 점수는 85~100 범위만 인정(연도 오인 방지).
 *  Vivino류 커뮤니티 평점(4.x)은 가점·표시 모두 제외 — 평론가 점수만 자산으로 친다. */
function awardInfoOf(text: string | null | undefined): { bonus: number; note: string | null } {
  const t = (text || '').trim();
  if (!t || /없음|미공개|미확인/.test(t)) return { bonus: 0, note: null };
  const segs = t.split(/[,·;|]|(?<=점)\s+/).map((s) => s.trim())
    .filter((s) => s && !/vivino|비비노|커뮤니티|평균|cellartracker/i.test(s));
  const scoreOf = (s: string) => {
    // "89/100"의 분모, "Top 100 선정"류의 100은 점수가 아님 — 매칭 전에 제거
    const clean = s.replace(/\/\s*100\b/g, '').replace(/top\s*100|100\s*(선|대|위|중)/gi, '');
    const m = [...clean.matchAll(/(?<![\d/])(8[5-9]|9[0-9]|100)(?!\d)/g)].map((x) => Number(x[1]));
    return m.length ? Math.max(...m) : 0;
  };
  let best: { seg: string; score: number } | null = null;
  for (const s of segs) {
    const sc = scoreOf(s);
    if (sc && (!best || sc > best.score)) best = { seg: s, score: sc };
  }
  const max = best?.score || 0;
  const bonus = max >= 98 ? 10 : max >= 95 ? 8 : max >= 90 ? 5 : max >= 85 ? 3
    : /금메달|골드|gold|트로피/i.test(t) ? 2 : 0;
  if (bonus === 0) return { bonus: 0, note: null };
  // 표시: 점수가 실제로 들어있는 세그먼트. 문장형이거나 길면 "평론가 N점"으로 축약
  const seg = (best?.seg || '').replace(/^수상[·:\s]*/, '').replace(/^[—–\-([\s]+|[)\]\s]+$/g, '').trim();
  // 문장 파편("전후이며 비평가에 따라 95~98점" 등)은 표기용으로 부적합 → 축약형으로
  const fragment = /[은는이가을를]\s|이며|하며|따라|기준|으로|에서/.test(seg);
  const note = max > 0
    ? (seg.length > 0 && seg.length <= 30 && !fragment ? seg : `평론가 ${max}점`)
    : null;
  return { bonus, note };
}

/** vintage_note → 음용적기 상태. 조사 때 "음용적기 지남/산화 우려" 등을 기록해 둔 것을 활용 */
function peakOf(text: string | null | undefined): 'peak' | 'past' | null {
  const t = text || '';
  if (!t) return null;
  if (/적기[를을가 ]*(지|넘|경과)|음용\s*적기\s*지남|산화\s*우려|퇴색|과숙|내리막/.test(t)) return 'past';
  if (/절정|정점|음용\s*적기(?![를을가 ]*(지|넘|경과))/.test(t)) return 'peak';
  return null;
}

/** vintage_note 첫 문장 — 카드에 얹는 짧은 빈티지 대본 */
function vintageHintOf(text: string | null | undefined): string | null {
  const t = (text || '').trim();
  if (!t) return null;
  const first = t.split(/(?<=\.)\s+/)[0].replace(/\s+/g, ' ').trim();
  if (!first) return null;
  return first.length > 90 ? `${first.slice(0, 88)}…` : first;
}

/** 같은 와인의 용량·포장 변형을 한 장으로 묶는 키 (이름에서 용량·빈티지·포장 표기 제거) */
function wineKeyOf(name: string): string {
  return name
    .replace(/\d+(\.\d+)?\s*(ml|㎖|l)\b/gi, '')
    .replace(/매그넘|하프|우드박스|기프트|에디션|\bGB\b|\bWB\b|\bWCS\b/gi, '')
    .replace(/(19|20)\d{2}/g, '')
    .replace(/[^가-힣a-z]/gi, '')
    .toLowerCase();
}

/** 일자 시드 셔플 — 동점을 매일 다른 순서로 돌려 추천 다양화 (하루 안에서는 안정) */
function dailyJitter(code: string): number {
  const s = code + new Date().toISOString().slice(0, 10);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0) % 9973;
}

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
  const wines = new Map<string, { item_name_kr: string; item_name_en: string; vintage: string; country: string; region: string; wine_type: string; grape_varieties: string; brand: string | null; supplier: string | null }>();
  const notes = new Map<string, Note & { awards: string | null; vintage_note: string | null }>();
  for (let i = 0; i < codes.length; i += 400) {
    const batch = codes.slice(i, i + 400);
    const [{ data: ws }, { data: ns }] = await Promise.all([
      supabase.from('wines').select('item_code, item_name_kr, item_name_en, vintage, country, region, wine_type, grape_varieties, image_url, brand, supplier').in('item_code', batch),
      supabase.from('tasting_notes').select('wine_id, flavor_tags, body, sweetness, acidity, tannin, awards, vintage_note').in('wine_id', batch),
    ]);
    for (const w of ws || []) wines.set(w.item_code, w);
    for (const n of ns || []) notes.set(n.wine_id, { ...n, flavor_tags: (n.flavor_tags || []) as string[] });
  }
  return rows.flatMap((r) => {
    const w = wines.get(r.code);
    if (!w || !w.item_name_kr) return [];
    if (NON_WINE_NAME.test(w.item_name_kr)) return [];
    const note = notes.get(r.code) || null;
    const award = awardInfoOf(note?.awards);
    return [{
      item_code: r.code,
      name: w.item_name_kr, name_en: w.item_name_en || '',
      vintage: w.vintage || '',
      country: w.country || '', region: w.region || '',
      type: normalizeWineType(w.wine_type || ''),
      grapes: (w.grape_varieties || '').toLowerCase(),
      retail: r.retail, stock: r.stock,
      tags: note?.flavor_tags || [],
      note,
      imgVer: cacheVer((w as unknown as { image_url?: string }).image_url || ''),
      producer: (w.brand || w.supplier || w.item_name_kr.split(/[\s,·]/)[0] || '').toLowerCase(),
      awardBonus: award.bonus,
      awardNote: award.note,
      peak: peakOf(note?.vintage_note),
      vintageHint: vintageHintOf(note?.vintage_note),
    }];
  });
}

// 품종 기반 바디 근사 — 조사값·향미 태그가 없는 와인 폴백
const FULL_GRAPES = ['cabernet', 'syrah', 'shiraz', 'malbec', 'zinfandel', 'mourvedre', 'petite sirah', 'nebbiolo', 'aglianico', 'touriga', '카베르네', '시라', '쉬라즈', '말벡', '네비올로'];
const LIGHT_GRAPES = ['pinot noir', 'gamay', 'riesling', 'sauvignon blanc', 'albarino', 'albariño', 'pinot grigio', 'pinot gris', 'vinho verde', '피노 누아', '피노누아', '가메', '리슬링', '소비뇽'];

function bodyOf(w: PoolWine): 'full' | 'light' | '' {
  const b = w.note?.body;
  if (b != null) return b >= 4 ? 'full' : b <= 2 ? 'light' : '';
  // 태그는 노트 텍스트 추출이라 노이즈("진한 체리"→full_body, "구조감"→tannic)가 섞임 —
  // 상충하면 품종이 우선(피노누아=라이트). tannic 단독은 최후 순위.
  const full = w.tags.includes('full_body');
  const light = w.tags.includes('light_body');
  if (full && !light) return 'full';
  if (light && !full) return 'light';
  if (FULL_GRAPES.some((g) => w.grapes.includes(g))) return 'full';
  if (LIGHT_GRAPES.some((g) => w.grapes.includes(g))) return 'light';
  if (w.tags.includes('tannic')) return 'full';
  return '';
}

/** 표시용 구조 프로파일 — 조사값 우선, 없으면 타입·태그로 추정 */
function structureOf(w: PoolWine): { body: number; tannin: number; acidity: number; sweetness: number } {
  const est = bodyOf(w);
  const body = w.note?.body ?? (est === 'full' ? 4 : est === 'light' ? 2 : 3);
  const tannin = w.note?.tannin
    ?? (w.type === 'red' ? (est === 'light' ? 2 : w.tags.includes('tannic') ? 4 : 3) : 1);
  const acidity = w.note?.acidity
    ?? (w.type === 'white' || w.type === 'sparkling' ? 4 : w.tags.includes('light_body') ? 4 : 3);
  const sweet = /모스카토|moscato|아이스바인|eiswein|소테른|sauternes/i.test(w.name + ' ' + w.name_en);
  const sweetness = w.note?.sweetness ?? (w.type === 'fortified' || sweet ? 4 : 1);
  return { body, tannin, acidity, sweetness };
}

function scoreWine(w: PoolWine, a: QuizAnswers): { score: number; matched: string[] } {
  let score = 0;
  const matched: string[] = [];
  // 향미: 취향 그룹당 1회 인정(그룹 내 2키 이상 매치는 확신 보정으로 +4 한 번만).
  // 예전 방식(매치 키 개수 × 8)은 태그가 많은 와인이 표면적만으로 이기고,
  // 그룹 하나가 4키로 확장돼 한 취향이 4번 카운트되는 편향이 있었다.
  for (const g of a.flavorGroups) {
    const keys = FLAVOR_GROUPS[g]?.keys || [];
    const hits = keys.filter((k) => w.tags.includes(k));
    if (hits.length) {
      score += hits.length >= 2 ? 12 : 8;
      matched.push(...hits.slice(0, 2));
    }
  }
  // 세부 향미 개별 선택(드릴다운)은 더 정밀한 취향 — 개당 6점
  for (const f of a.flavors || []) {
    if (w.tags.includes(f) && !matched.includes(f)) { score += 6; matched.push(f); }
  }
  if (score > 40) score = 40;

  // 바디: 실측 축이 있으면 거리 기반(전 품목 조사 완료로 대부분 실측), 없으면 추정 폴백.
  // Full 목표=5(가장 묵직할수록 유리), 두 단계 이상 어긋나면 -15로 강하게 감점(무게감 반영 강화).
  if (a.body) {
    const target = a.body === 'light' ? 2 : a.body === 'medium' ? 3 : 5;
    const b = w.note?.body;
    if (b != null) {
      const diff = Math.abs(b - target);
      score += diff === 0 ? 15 : diff === 1 ? 6 : -15;
    } else {
      const est = bodyOf(w);
      if (a.body === 'light') score += est === 'light' ? 15 : est === 'full' ? -15 : 0;
      else if (a.body === 'full') score += est === 'full' ? 15 : est === 'light' ? -15 : 0;
      else score += est === '' ? 8 : 3;
    }
  }

  // Sweet 문답이면 당도 강도 가점 (게이트 통과 후 강한 쪽 우선)
  if (a.type === 'sweet') {
    const s = structureOf(w).sweetness;
    if (s >= 5) score += 8; else if (s >= 4) score += 5;
  }

  score += w.awardBonus;                       // 평점 자산 (RP·JS 등 95+면 크게)
  if (w.peak === 'past') score -= 20;          // 음용적기 지남/산화 우려 — 강한 감점
  else if (w.peak === 'peak') score += 3;      // 지금이 절정
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
  // 정렬: 점수 → 평점 자산 → 일자 시드 셔플. (예전의 '가격 오름차순' 동점 처리는
  // 점수 단위가 거칠어 사실상 최저가 정렬이 되는 문제가 있었다 — 제거)
  const scored = filtered
    .map((w) => ({ w, ...scoreWine(w, a) }))
    .sort((x, y) => y.score - x.score || y.w.awardBonus - x.w.awardBonus
      || dailyJitter(x.w.item_code) - dailyJitter(y.w.item_code));

  // 다양성 가드: ① 같은 와인의 용량·포장 변형은 최고 순위 1장만
  //             ② 같은 생산자는 상위권에 최대 2장 — 초과분은 제거하지 않고 뒤로 밀어 더보기에서 노출
  const seenWine = new Set<string>();
  const producerCount = new Map<string, number>();
  const head: typeof scored = [];
  const tail: typeof scored = [];
  for (const s of scored) {
    const wk = wineKeyOf(s.w.name);
    if (wk && seenWine.has(wk)) continue;
    if (wk) seenWine.add(wk);
    const pk = s.w.producer;
    const cnt = producerCount.get(pk) || 0;
    if (pk && cnt >= 2) { tail.push(s); continue; }
    if (pk) producerCount.set(pk, cnt + 1);
    head.push(s);
  }
  const picked = [...head, ...tail].slice(0, limit);

  return picked.map(({ w, score, matched }) => ({
    item_code: w.item_code,
    name: w.name, name_en: w.name_en, vintage: w.vintage,
    country: w.country, region: w.region,
    retail_price: w.retail, stock: w.stock,
    flavors: w.tags.slice(0, 5).map((k) => FLAVOR_KO[k] || k),
    reason: buildReason(w, a, matched),
    img_ver: w.imgVer,
    ...structureOf(w),
    score,
    award_note: w.awardNote,
    vintage_hint: w.vintageHint,
    peak: w.peak,
  }));
}
