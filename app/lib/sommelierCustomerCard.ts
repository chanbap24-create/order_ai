// 단골 카드·재방문 환영(서버 전용) — 손님 한 명의 방문·구매·취향 + 직원 메모. 계산은 엑셀/관리자와 같은 buildTastes 재사용.
// 보기 범위: 소믈리에 관리자(박경아·조성재·admin)는 전체, 그 외 계정은 본인이 등록한 고객만(customerScopeOf).
import { supabase } from './db';
import { buildTastes, type CustomerRow, type OrderRow, type SessionRow } from './sommelierExport/data';
import { answerSummary } from '@/app/sommelier/lib/answerSummary';
import { EMPTY_ANSWERS, type QuizAnswers } from '@/app/sommelier/lib/quiz';
import { canEditDiscounts } from './sommelierDiscount';
import { AGE_BANDS, GENDERS, type AgeBand, type CustomerCardData, type Gender } from '@/app/store/customer/types';
import { CONSENT_VERSION } from './sommelierDb';
import { loadRegionGrouper } from './wineRegionGroup';
import { daysAgoKst } from './dateKst';

const kstDate = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10) : '');
const mask = (p: string) => String(p || '').replace(/^(\d{3})\d{3,4}(\d{4})$/, '$1-****-$2');

/** 고객 정보 보기 범위 — 소믈리에 관리자(박경아·조성재·admin)는 전체, 그 외 계정은 본인이 등록한 고객만.
 *  owner=null 이면 전체. 고객 목록·단골 카드·메모가 같은 판정을 쓴다 */
export type CustomerScope = { owner: string | null };
export const customerScopeOf = (session: { manager: string; role: string }): CustomerScope =>
  ({ owner: canEditDiscounts(session) ? null : session.manager });

export type CustomerListRow = {
  id: number; name: string; phoneMasked: string; lastVisit: string; purchases: number; amount: number; marketing: boolean;
  registered: string; // 등록일(KST)
  isNew: boolean;     // 최근 7일 안에 등록 — 고객 목록 맨 위 '최근 등록'
};

/** 고객 목록 — 보기 범위 안에서, 이름 일부 검색(선택). 최근 방문 순(최근 7일 등록은 isNew로 표시) */
export async function listCustomers(scope: CustomerScope, q: string): Promise<CustomerListRow[]> {
  let cq = supabase.from('sommelier_customers').select('id, name, phone, created_at, marketing_opt_in').order('id', { ascending: false }).limit(300);
  if (scope.owner) cq = cq.eq('created_by', scope.owner);
  const name = q.trim().replace(/[%_,()]/g, '');
  if (name) cq = cq.ilike('name', `%${name}%`);
  const { data: cs } = await cq;
  const list = cs || [];
  if (!list.length) return [];
  const newSince = daysAgoKst(6); // 오늘 포함 7일
  const cids = list.map((c) => c.id);
  const [{ data: os }, { data: ss }] = await Promise.all([
    supabase.from('sommelier_orders').select('customer_id, sale_id, created_at, amount, retail_price, quantity').in('customer_id', cids),
    supabase.from('sommelier_sessions').select('customer_id, created_at').in('customer_id', cids),
  ]);
  return list.map((c) => {
    const mine = (os || []).filter((o) => o.customer_id === c.id);
    const last = [c.created_at, ...mine.map((o) => o.created_at), ...(ss || []).filter((x) => x.customer_id === c.id).map((x) => x.created_at)].sort().pop() || c.created_at;
    return {
      id: c.id, name: c.name, phoneMasked: mask(c.phone), lastVisit: kstDate(last), marketing: !!c.marketing_opt_in,
      registered: kstDate(c.created_at), isNew: kstDate(c.created_at) >= newSince,
      purchases: new Set(mine.map((o) => o.sale_id || String(o.created_at).slice(0, 10))).size,
      amount: mine.reduce((a, o) => a + (Number(o.amount ?? (Number(o.retail_price) || 0) * (Number(o.quantity) || 1)) || 0), 0),
    };
  }).sort((a, b) => b.lastVisit.localeCompare(a.lastVisit));
}

export async function canViewCustomer(scope: CustomerScope, customerId: number): Promise<boolean> {
  if (!scope.owner) return true;
  const { data } = await supabase.from('sommelier_customers').select('created_by').eq('id', customerId).maybeSingle();
  return data?.created_by === scope.owner; // 고객 목록과 같은 판정
}

/** 구매 취향 → 문답 답변(타입·바디·가격대). 국가·향은 비워 추천 폭을 남긴다 */
function suggestAnswers(o: OrderRow[], avgBody: number | null, avgUnit: number): QuizAnswers {
  const typeOf = (t: string) => (/스위트|디저트|주정|포트|sweet|dessert|fortified/i.test(t) ? 'sweet'
    : /스파클링|샴페인|크레망|sparkling|champagne/i.test(t) ? 'sparkling'
    : /화이트|white/i.test(t) ? 'white' : /레드|red/i.test(t) ? 'red' : null);
  const counts = new Map<string, number>();
  for (const r of o) { const k = typeOf(String(r.wine_type || '')); if (k) counts.set(k, (counts.get(k) || 0) + (Number(r.quantity) || 1)); }
  const type = ([...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null) as QuizAnswers['type'];
  const body = avgBody == null ? null : avgBody <= 2.3 ? 'light' : avgBody >= 3.7 ? 'full' : 'medium';
  const round = (n: number) => Math.round(n / 10000) * 10000;
  return {
    ...EMPTY_ANSWERS, type, body,
    priceMin: avgUnit > 0 ? round(avgUnit * 0.7) : null,
    priceMax: avgUnit > 0 ? Math.max(round(avgUnit * 1.4), round(avgUnit * 0.7) + 10000) : null,
  };
}

export async function loadCustomerCard(id: number): Promise<CustomerCardData | null> {
  const [{ data: c }, { data: orders }, { data: sessions }, regionOf] = await Promise.all([
    supabase.from('sommelier_customers').select('*').eq('id', id).maybeSingle(),
    supabase.from('sommelier_orders').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
    supabase.from('sommelier_sessions').select('id, customer_id, manager, created_at, answers, results').eq('customer_id', id).order('created_at', { ascending: false }),
    loadRegionGrouper(),
  ]);
  if (!c) return null;
  const os = (orders || []) as OrderRow[];
  const ss = (sessions || []) as SessionRow[];
  const t = buildTastes([c as CustomerRow], os, ss, regionOf)[0];
  const boughtIn = (sid: number) => os.filter((x) => x.session_id === sid).reduce((a, x) => a + (Number(x.quantity) || 1), 0);
  return {
    id: c.id, name: c.name, phoneMasked: mask(c.phone), marketing: !!c.marketing_opt_in,
    firstVisit: kstDate(t.firstVisit || c.created_at), lastVisit: kstDate(t.lastVisit || t.lastPurchase || c.created_at),
    registeredBy: c.created_by || '—',
    stats: { visits: t.sessions, purchases: t.sales, bottles: t.bottles, amount: t.amount, avgUnit: t.avgUnit },
    taste: {
      type: t.topType, countries: t.topCountries.replace(/, /g, ' · '), regions: t.topRegions.replace(/, /g, ' · '),
      // 품종은 병 수와 함께 — 블렌드는 품종 수로 나눈 값(0.5병 등)
      grapes: t.grapeCounts.map(([g, n]) => `${g} ${n}`).join(' · '),
      body: t.avgBody, sweetness: t.avgSweet, acidity: t.avgAcid, tannin: t.avgTannin,
      flavorGroups: t.flavorGroups,
      quiz: { type: t.quizType, body: t.quizBody, price: t.quizPrice, flavors: t.quizFlavors }, // 그룹명에 '·'가 들어 있어 쉼표로 구분
    },
    purchases: os.map((o) => ({
      date: kstDate(o.created_at), name: o.item_name || o.item_code, vintage: o.vintage || null,
      qty: Number(o.quantity) || 1, amount: Number(o.amount ?? (Number(o.retail_price) || 0) * (Number(o.quantity) || 1)) || 0,
      source: o.source === 'quiz' ? 'quiz' : 'stock',
    })),
    sessionCount: ss.length,
    sessions: ss.slice(0, 3).map((x) => ({ date: kstDate(x.created_at), answers: answerSummary(x.answers || {}), bought: boughtIn(x.id) })),
    profile: {
      ageBand: c.age_band || null, gender: c.gender || null, canEdit: (c.consent_version || 1) >= CONSENT_VERSION,
      meta: c.profile_updated_by ? `${c.profile_updated_by} · ${kstDate(c.profile_updated_at).slice(5).replace('-', '.')} 기록` : '',
    },
    memo: c.memo || '',
    memoMeta: c.memo_updated_by ? `${c.memo_updated_by} · ${kstDate(c.memo_updated_at).slice(5).replace('-', '.')} 수정` : '',
    suggested: suggestAnswers(os, t.avgBody, t.avgUnit),
  };
}

export async function saveCustomerMemo(id: number, memo: string, staff: string): Promise<void> {
  const { error } = await supabase.from('sommelier_customers')
    .update({ memo: memo.trim().slice(0, 1000) || null, memo_updated_at: new Date().toISOString(), memo_updated_by: staff }).eq('id', id);
  if (error) throw error;
}

/** 연령대·성별 저장(직원 대략 기록). 옛 동의(성함·연락처만 고지) 손님은 거부 — 고지한 항목만 수집 */
export async function saveCustomerProfile(id: number, p: { ageBand: unknown; gender: unknown }, staff: string): Promise<boolean> {
  const ageBand = AGE_BANDS.some(([k]) => k === p.ageBand) ? p.ageBand as AgeBand : null;
  const gender = GENDERS.some(([k]) => k === p.gender) ? p.gender as Gender : null;
  const { data } = await supabase.from('sommelier_customers')
    .update({ age_band: ageBand, gender, profile_updated_at: new Date().toISOString(), profile_updated_by: staff })
    .eq('id', id).gte('consent_version', CONSENT_VERSION).select('id');
  return !!data?.length;
}

/** 재방문 환영 — 손님 앞 화면용 최소 정보(금액·메모 없음). 손님은 다른 직원에게 다시 올 수 있으므로
 *  매장 앱 계정이면 누구나 조회. 단골 카드(금액·메모)를 열 수 있는지만 따로 알려준다. */
export type WelcomeInfo = {
  lastWine: string | null; lastDate: string | null; suggested: QuizAnswers | null; canViewCard: boolean;
  // 손님용 카드 — 손님에게 보여줘도 되는 것만(금액·수량·연락처·메모 없음)
  taste: { type: string; countries: string; regions: string; grapes: string; flavorGroups: Array<{ type: string; flavors: string[] }> } | null;
  purchases: Array<{ date: string; name: string }>; // 최근 3건
  marketing: boolean;       // 광고성 정보 수신 동의 여부 — 손님용 카드에서 바로 동의/철회
  consentCurrent: boolean;  // 현재 동의 문구(수집 항목)에 동의했는가 — 아니면 카드에서 다시 받음
};

export async function loadWelcome(id: number, scope: CustomerScope): Promise<WelcomeInfo | null> {
  const [{ data: c }, { data: orders }, { data: sessions }, regionOf] = await Promise.all([
    supabase.from('sommelier_customers').select('*').eq('id', id).maybeSingle(),
    supabase.from('sommelier_orders').select('*').eq('customer_id', id).order('created_at', { ascending: false }).limit(50),
    supabase.from('sommelier_sessions').select('id, customer_id, manager, created_at, answers, results').eq('customer_id', id).order('created_at', { ascending: false }).limit(20),
    loadRegionGrouper(),
  ]);
  if (!c) return null;
  const os = (orders || []) as OrderRow[];
  const ss = (sessions || []) as SessionRow[];
  const last = os[0];
  // 추천 답변: 구매가 있으면 구매 취향, 없으면 마지막 문답 답변 그대로
  const t = os.length ? buildTastes([c as CustomerRow], os, ss, regionOf)[0] : null;
  let suggested: QuizAnswers | null = null;
  if (t) suggested = suggestAnswers(os, t.avgBody, t.avgUnit);
  else if (ss[0]?.answers) suggested = { ...EMPTY_ANSWERS, ...ss[0].answers };
  const wineName = (o: OrderRow) => `${o.item_name || o.item_code}${o.vintage ? ` ${o.vintage}` : ''}`;
  return {
    taste: t ? {
      type: t.topType, countries: t.topCountries.replace(/, /g, ' · '), regions: t.topRegions.replace(/, /g, ' · '),
      grapes: t.topGrapes.split(', ').slice(0, 3).join(' · '), // 손님 화면은 짧게 3개
      flavorGroups: t.flavorGroups,
    } : null,
    purchases: os.slice(0, 3).map((o) => ({ date: kstDate(o.created_at), name: wineName(o) })),
    lastWine: last ? wineName(last) : null,
    lastDate: last ? kstDate(last.created_at) : null,
    suggested,
    canViewCard: !scope.owner || c.created_by === scope.owner,
    marketing: !!c.marketing_opt_in,
    consentCurrent: (c.consent_version || 1) >= CONSENT_VERSION,
  };
}
