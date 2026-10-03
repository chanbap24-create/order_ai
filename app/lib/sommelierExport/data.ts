// 소믈리에 구매·문답 내보내기 데이터(서버 전용) — 엑셀 3시트(구매 기록 · 문답 이력 · 손님 취향 요약)의 원천.
// 손님 취향 요약은 기간과 무관하게 전체 이력으로 계산(취향은 누적 데이터라야 의미가 있음).
import { supabase } from '../db';
import { fetchAllRows } from '../fetchAll';
import { FLAVOR_KO } from '@/app/api/sales/recommend/lib/flavor';
import { BODY_OPTIONS, TYPE_OPTIONS } from '@/app/sommelier/lib/quiz';

const TYPE_LABEL: Record<string, string> = Object.fromEntries(TYPE_OPTIONS.filter((o) => o.value).map((o) => [o.value as string, o.label]));
const BODY_LABEL: Record<string, string> = Object.fromEntries(BODY_OPTIONS.filter((o) => o.value).map((o) => [o.value as string, o.label]));

/* eslint-disable @typescript-eslint/no-explicit-any */
export type OrderRow = Record<string, any>;
export type SessionRow = { id: number; customer_id: number; manager: string; created_at: string; answers: any; results: any[] };
export type CustomerRow = { id: number; name: string; phone: string; created_at: string; created_by: string | null; marketing_opt_in: boolean | null };

export type CustomerTaste = {
  customer: CustomerRow;
  sessions: number; firstVisit: string | null; lastVisit: string | null;
  sales: number; lines: number; bottles: number; amount: number; avgUnit: number; lastPurchase: string | null;
  topType: string; topCountries: string; topGrapes: string; topFlavors: string;
  avgBody: number | null; avgSweet: number | null; avgAcid: number | null; avgTannin: number | null;
  quizType: string; quizBody: string; quizPrice: string; recShare: number | null;
};

/** KST 날짜(YYYY-MM-DD) → UTC ISO 경계 */
const kstStart = (d: string) => new Date(`${d}T00:00:00+09:00`).toISOString();
const kstEndExclusive = (d: string) => new Date(new Date(`${d}T00:00:00+09:00`).getTime() + 86400_000).toISOString();

export async function loadExportData(from: string | null, to: string | null) {
  const inRange = (iso: string) => (!from || iso >= kstStart(from)) && (!to || iso < kstEndExclusive(to));
  const [orders, sessions, customers] = await Promise.all([
    fetchAllRows<OrderRow>((f, t) => supabase.from('sommelier_orders').select('*').order('created_at').range(f, t)),
    fetchAllRows<SessionRow>((f, t) => supabase.from('sommelier_sessions').select('id, customer_id, manager, created_at, answers, results').order('created_at').range(f, t)),
    fetchAllRows<CustomerRow>((f, t) => supabase.from('sommelier_customers').select('id, name, phone, created_at, created_by, marketing_opt_in').order('id').range(f, t)),
  ]);
  return {
    orders: orders.filter((o) => inRange(o.created_at)),
    sessions: sessions.filter((s) => inRange(s.created_at)),
    customers,
    tastes: buildTastes(customers, orders, sessions), // 전체 이력
  };
}

const top = (counts: Map<string, number>, n: number) =>
  [...counts.entries()].filter(([k]) => k).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k).join(', ');
const bump = (m: Map<string, number>, k: string | null | undefined, w: number) => { if (k) m.set(k, (m.get(k) || 0) + w); };
const wavg = (pairs: Array<[number | null, number]>) => {
  const ok = pairs.filter(([v]) => v != null) as Array<[number, number]>;
  const w = ok.reduce((a, [, q]) => a + q, 0);
  return w ? Math.round((ok.reduce((a, [v, q]) => a + v * q, 0) / w) * 10) / 10 : null;
};
// 품종 문자열 '샤르도네 Chardonnay 100' / 'Pinot Noir, Chardonnay' → 품종명만
const grapesOf = (g: string | null) => (g || '').split(/[,/]/).map((x) => x.replace(/\d+%?/g, '').trim()).filter(Boolean);

/** 손님별 취향 요약 — 엑셀 '손님 취향 요약' 시트·관리자 소믈리에 탭·단골 카드 공용 */
export function buildTastes(customers: CustomerRow[], orders: OrderRow[], sessions: SessionRow[]): CustomerTaste[] {
  return customers.map((c) => {
    const os = orders.filter((o) => o.customer_id === c.id);
    const ss = sessions.filter((s) => s.customer_id === c.id);
    const types = new Map<string, number>(); const countries = new Map<string, number>();
    const grapes = new Map<string, number>(); const flavors = new Map<string, number>();
    for (const o of os) {
      const q = Number(o.quantity) || 1;
      bump(types, o.wine_type, q); bump(countries, o.country, q);
      for (const g of grapesOf(o.grapes)) bump(grapes, g, q);
      // 향 태그 → 한글. light_body·full_body 같은 바디 표시는 향이 아니라 제외
      for (const f of o.flavor_tags || []) if (!/_body$/.test(f)) bump(flavors, FLAVOR_KO[f] || f, q);
    }
    const qTypes = new Map<string, number>(); const qBody = new Map<string, number>(); const qPrice = new Map<string, number>();
    for (const s of ss) {
      // 문답 값 → 화면 표기(Red·Light 등)
      bump(qTypes, TYPE_LABEL[s.answers?.type] || s.answers?.type, 1); bump(qBody, BODY_LABEL[s.answers?.body] || s.answers?.body, 1);
      if (s.answers?.priceMin != null || s.answers?.priceMax != null) {
        bump(qPrice, `${Math.round((s.answers.priceMin || 0) / 10000)}~${s.answers.priceMax ? Math.round(s.answers.priceMax / 10000) : ''}만원`, 1);
      }
    }
    const bottles = os.reduce((a, o) => a + (Number(o.quantity) || 0), 0);
    const amount = os.reduce((a, o) => a + (Number(o.amount ?? (Number(o.retail_price) || 0) * (Number(o.quantity) || 0)) || 0), 0);
    const pairs = (k: string) => os.map((o) => [o[k] == null ? null : Number(o[k]), Number(o.quantity) || 1] as [number | null, number]);
    const recKnown = os.filter((o) => o.recommended != null);
    const dates = (xs: string[]) => xs.sort();
    const sd = dates(ss.map((s) => s.created_at)); const od = dates(os.map((o) => o.created_at));
    return {
      customer: c, sessions: ss.length, firstVisit: sd[0] || null, lastVisit: sd[sd.length - 1] || null,
      sales: new Set(os.map((o) => o.sale_id || `${o.created_at.slice(0, 10)}`)).size, lines: os.length, bottles, amount,
      avgUnit: bottles ? Math.round(amount / bottles) : 0, lastPurchase: od[od.length - 1] || null,
      topType: top(types, 1), topCountries: top(countries, 2), topGrapes: top(grapes, 3), topFlavors: top(flavors, 5),
      avgBody: wavg(pairs('body')), avgSweet: wavg(pairs('sweetness')), avgAcid: wavg(pairs('acidity')), avgTannin: wavg(pairs('tannin')),
      quizType: top(qTypes, 1), quizBody: top(qBody, 1), quizPrice: top(qPrice, 1),
      recShare: recKnown.length ? Math.round((recKnown.filter((o) => o.recommended).length / recKnown.length) * 100) : null,
    };
  });
}
