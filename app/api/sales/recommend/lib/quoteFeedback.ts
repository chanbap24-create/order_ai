// 거래처 견적 피드백(학습): 과거 견적에 담은 와인들을 '속성 단위'로 분해해 전환(구매) 여부를 누적.
// 비대칭 설계 — 긍정(먹힌 속성=산지·가격대·타입·품종·향)만 비슷한 새 와인으로 넓혀 가산한다.
// 거절(안 산 것)은 그 병 특유일 수 있어 일반화하면 왜곡 → 여기서 안 다룸(품목 단위 noconvPenalty가 담당).
// 거래처 단위. 데이터는 saved_quotes+shipments+wines.
import { supabase } from '@/app/lib/db';
import { findHierarchy, type WineRegionRow } from './regions';
import { normalizeType } from './wineType';
import { extractFlavorKeys } from './flavor';
import { geoGroup } from './geoTier';

const WINDOW_DAYS = 60; // 견적일 ~ +60일 내 출고면 '전환'
const SHRINK_K = 3;     // 신뢰도 보정(견적 적은 속성은 영향 축소). 15번이면 conf≈0.83(강). 클수록 단발에 둔감
const CLAMP = 5;        // 속성 합 정규화 범위(=속성 수). 클수록 한 속성당 칸이 작아 촘촘

export type FB = { quoted: number; converted: number };
export interface QuoteFeedbackProfile {
  region: Map<string, FB>;
  priceBand: Map<string, FB>;
  type: Map<string, FB>;
  grape: Map<string, FB>;
  flavor: Map<string, FB>;
  discount: Map<string, FB>; // 할인률 밴드(학습은 하지만 후보는 할인 미정이라 점수엔 미반영 — 권장 할인 참고용)
  baseline: number;          // 거래처 전체 평균 전환율
  totalItems: number;
}

export function priceBandKey(price: number): string {
  if (price >= 300000) return '30만+';
  if (price >= 200000) return '20만대';
  if (price >= 100000) return '10만대';
  if (price >= 50000) return '5만대';
  if (price >= 20000) return '2만대';
  if (price > 0) return '2만↓';
  return '';
}
export function discountBandKey(rate: number): string {
  if (rate <= 0) return '0%';
  if (rate < 0.1) return '~10%';
  if (rate < 0.2) return '10~20%';
  return '20%+';
}
export function grapeKeysOf(grapes: string): string[] {
  return grapes.toLowerCase().split(/[,/&]/).map((g) => g.trim()).filter((g) => g.length >= 3);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function addFB(map: Map<string, FB>, key: string, converted: boolean) {
  if (!key) return;
  const fb = map.get(key) || { quoted: 0, converted: 0 };
  fb.quoted += 1;
  if (converted) fb.converted += 1;
  map.set(key, fb);
}

/** 거래처의 과거 견적을 속성 단위 전환 프로필로 변환. 견적 이력 없으면 null. */
export async function getClientQuoteFeatures(
  clientCode: string,
  regionRows: WineRegionRow[],
  asOf?: string, // as-of 컷오프(백테스트 전용): 이 날짜 이전 견적·출고만 사용(leakage 방지). 미지정=전체.
): Promise<QuoteFeedbackProfile | null> {
  let qq = supabase
    .from('saved_quotes')
    .select('items, created_at')
    .eq('client_code', clientCode);
  if (asOf) qq = qq.lt('created_at', asOf);
  const { data: quotes } = await qq.order('created_at', { ascending: true });
  const qList = (quotes || []) as Array<{ items?: AnyRow[]; created_at: string }>;
  if (qList.length === 0) return null;

  // 견적에 등장한 품번 union + 가장 이른 견적일
  const codes = new Set<string>();
  let earliest = '9999-99-99';
  for (const q of qList) {
    for (const it of q.items || []) if (it.item_code) codes.add(String(it.item_code));
    const d = String(q.created_at).slice(0, 10);
    if (d < earliest) earliest = d;
  }
  const codeArr = [...codes];

  // 출고(전환 판정) + 와인 속성/향미 — 200개씩 배치
  const shipByCode = new Map<string, { date: string; qty: number }[]>();
  const wineMap = new Map<string, AnyRow>();
  const notesMap = new Map<string, string>();
  for (let i = 0; i < codeArr.length; i += 200) {
    const slice = codeArr.slice(i, i + 200);
    const [shipRes, wineRes, noteRes] = await Promise.all([
      supabase.from('shipments').select('item_no, quantity, ship_date').eq('client_code', clientCode).in('item_no', slice).gte('ship_date', earliest).gt('selling_price', 0), // 무상 시음주(selling_price=0) 제외 — 실제 유상 입고만 전환으로 인정
      supabase.from('wines').select('item_code, country, country_en, grape_varieties, wine_type, region, item_name_kr, item_name_en').in('item_code', slice),
      supabase.from('tasting_notes').select('wine_id, nose_note, palate_note').in('wine_id', slice),
    ]);
    for (const s of (shipRes.data || []) as AnyRow[]) {
      const a = shipByCode.get(s.item_no) || [];
      a.push({ date: String(s.ship_date), qty: Number(s.quantity) || 0 });
      shipByCode.set(s.item_no, a);
    }
    for (const w of (wineRes.data || []) as AnyRow[]) wineMap.set(w.item_code, w);
    for (const n of (noteRes.data || []) as AnyRow[]) notesMap.set(n.wine_id, `${n.nose_note || ''} ${n.palate_note || ''}`.trim());
  }

  const featOf = (code: string, price: number, discount: number) => {
    const w = wineMap.get(code);
    const h = w ? findHierarchy(w.region || '', `${w.item_name_kr || ''} ${w.item_name_en || ''}`, regionRows, w.country_en || w.country || '') : null;
    return {
      region: geoGroup(h),
      priceBand: priceBandKey(price),
      type: normalizeType(w?.wine_type || '', w?.item_name_kr || ''),
      grapes: grapeKeysOf(w?.grape_varieties || ''),
      flavors: [...extractFlavorKeys(notesMap.get(code) || '')],
      discount: discountBandKey(discount),
    };
  };

  const profile: QuoteFeedbackProfile = {
    region: new Map(), priceBand: new Map(), type: new Map(),
    grape: new Map(), flavor: new Map(), discount: new Map(),
    baseline: 0, totalItems: 0,
  };
  let totalQuoted = 0, totalConverted = 0;
  for (const q of qList) {
    const start = String(q.created_at).slice(0, 10);
    const end = addDays(start, WINDOW_DAYS);
    for (const it of q.items || []) {
      if (!it.item_code) continue;
      const ships = (shipByCode.get(String(it.item_code)) || []).filter((s) => s.date >= start && s.date <= end && (!asOf || s.date < asOf));
      const converted = ships.reduce((a, b) => a + b.qty, 0) > 0;
      const f = featOf(String(it.item_code), Number(it.supply_price) || 0, Number(it.discount_rate) || 0);
      addFB(profile.region, f.region, converted);
      addFB(profile.priceBand, f.priceBand, converted);
      addFB(profile.type, f.type, converted);
      for (const g of f.grapes) addFB(profile.grape, g, converted);
      for (const fl of f.flavors) addFB(profile.flavor, fl, converted);
      addFB(profile.discount, f.discount, converted);
      totalQuoted += 1;
      if (converted) totalConverted += 1;
    }
  }
  profile.totalItems = totalQuoted;
  profile.baseline = totalQuoted ? totalConverted / totalQuoted : 0;
  return profile;
}

/**
 * 후보 1건의 견적학습 '긍정' 점수(0~weight). 비대칭 설계:
 * - 긍정(먹힌 속성)은 비슷한 새 와인으로 넓혀 가산 → 여기서 처리(전환율×신뢰도, 음수 없음).
 * - 거절(안 산 것)은 그 병 특유일 수 있어 넓히면 왜곡 → 일반화 안 함. 품목 단위 noconvPenalty(scoring.ts)가 담당.
 */
export function scoreQuoteFeedback(
  p: QuoteFeedbackProfile,
  cand: { region: string; priceBand: string; type: string; grapes: string[]; flavors: string[] },
  weight: number,
): number {
  const dim = (map: Map<string, FB>, values: string[]): number => {
    let s = 0, n = 0;
    for (const v of values) {
      if (!v) continue;
      const fb = map.get(v);
      if (!fb || fb.quoted === 0) continue;
      const rate = fb.converted / fb.quoted;        // 전환율(0~1)
      const conf = fb.quoted / (fb.quoted + SHRINK_K); // 신뢰도(견적 적으면 축소)
      s += rate * conf;                              // 긍정만 — 전환 없으면 0(감점 아님)
      n += 1;
    }
    return n ? s / n : 0;
  };
  const sum =
    dim(p.region, [cand.region]) +
    dim(p.priceBand, [cand.priceBand]) +
    dim(p.type, [cand.type]) +
    dim(p.grape, cand.grapes) +
    dim(p.flavor, cand.flavors);
  const norm = Math.min(CLAMP, sum) / CLAMP; // [0, 1] — 순수 가산 헤드룸
  return Math.round(norm * weight * 10) / 10;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;
