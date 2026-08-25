import { supabase } from './db';
import { computeDueDate, type PaymentType } from '@/app/sales/outstanding/lib/dueDate';

// 오늘의 수금 브리핑 빌더 — 브리핑 화면(API)과 텔레그램/알림톡 발송이 공유하는 단일 소스.
// 연체(예정일 경과)/오늘 수금약속/약속어김 + 약속 이행 자동 판정(조기 입금 인정).

export function kstToday(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export interface CollItem {
  client_code: string; client_type: string; client_name: string;
  net_balance: number; overdue: number; days_overdue: number;
  due_date: string | null; oldest_unpaid_date: string | null;
  promised_date: string | null; promised_amount: number | null;
  /** 약속 금액 대비 확인된 입금 합계(약속일 14일 전~) — 부분 입금 차액 안내용 */
  promised_paid: number;
  stage: number; status: string; special: boolean; hidden: boolean;
}

export interface CollectionBriefing {
  today: string;
  promiseToday: CollItem[];
  broken: CollItem[];
  overdue: CollItem[];
  counts: { promiseToday: number; broken: number; overdue: number; special: number };
  /** 발신자(담당) — 수금 안내 문구의 서명용 */
  sender: { manager: string; title: string | null };
}

export async function buildCollectionBriefing(manager: string, today = kstToday()): Promise<CollectionBriefing> {
  const [wine, glass, fo, senderRow] = await Promise.all([
    supabase.rpc('calc_wine_aging', { p_manager: manager, p_as_of: today }),
    supabase.rpc('calc_glass_aging', { p_manager: manager, p_as_of: today }),
    supabase.from('collection_followups')
      .select('client_code, client_type, stage, status, promised_date, promised_amount, payment_type, hidden').eq('manager', manager),
    supabase.from('sales_users').select('title').eq('manager', manager).maybeSingle(),
  ]);

  const foMap = new Map<string, { stage: number; status: string; promised_date: string | null; promised_amount: number | null; payment_type: string | null; hidden: boolean }>();
  for (const f of (fo.data || [])) foMap.set(`${f.client_code}|${f.client_type}`, f);

  const days = (a: string, b: string) => Math.floor((new Date(a).getTime() - new Date(b).getTime()) / 86400000);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const build = (rows: any[], type: string): CollItem[] => (rows || []).map((r) => {
    const f = foMap.get(`${r.client_code}|${type}`);
    // 경과일 = 결제조건상 만기일(약속된 결제일)로부터. 만기일 산출 불가 시 출고일 기준 fallback.
    const dueDate = computeDueDate((f?.payment_type as PaymentType | null) ?? null, r.oldest_unpaid_date ?? null);
    const daysOverdue = dueDate ? days(today, dueDate)
      : (r.oldest_unpaid_date ? days(today, r.oldest_unpaid_date) : 0);
    return {
      client_code: r.client_code, client_type: type, client_name: r.client_name,
      net_balance: r.net_balance, overdue: r.overdue,
      days_overdue: daysOverdue, due_date: dueDate, oldest_unpaid_date: r.oldest_unpaid_date ?? null,
      promised_date: f?.promised_date ?? null, promised_amount: f?.promised_amount ?? null,
      promised_paid: 0,
      stage: f?.stage ?? 0, status: f?.status ?? 'open',
      special: r.overdue > 0 && daysOverdue >= 30,
      hidden: f?.hidden ?? false,
    };
  });

  const all = [...build(wine.data, 'wine'), ...build(glass.data, 'glass')];

  // ── 약속 이행 자동 판정 ──
  // 약속일 기준 '14일 전 ~ 이후' 입금 합계가 약속금액 이상이면 약속 이행 →
  // 다른 미수가 남아 있어도(net_balance>0) "오늘의 수금"에서 제외(자연 소멸).
  // 일찍 갚은 경우(약속일 전 입금)도 이행으로 인정 — 약속일 이후만 세면
  // 하루 먼저 입금한 거래처가 '약속어김'으로 오표기됨(뚜르몽 사례).
  // wine→payments, glass→glass_payments.
  const GRACE_DAYS = 14;
  const minusDays = (d: string, n: number) =>
    new Date(new Date(d).getTime() - n * 86400000).toISOString().slice(0, 10);
  const fulfilled = new Set<string>();
  const promised = all.filter((it) => it.promised_date && (it.promised_amount || 0) > 0);
  if (promised.length > 0) {
    const minPromise = promised.reduce((m, it) => (it.promised_date! < m ? it.promised_date! : m), promised[0].promised_date!);
    const minDate = minusDays(minPromise, GRACE_DAYS);
    const wineCodes = promised.filter((p) => p.client_type === 'wine').map((p) => p.client_code);
    const glassCodes = promised.filter((p) => p.client_type === 'glass').map((p) => p.client_code);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const empty = Promise.resolve({ data: [] as any[] });
    const [wp, gp] = await Promise.all([
      wineCodes.length ? supabase.from('payments').select('client_code, payment_date, amount').in('client_code', wineCodes).gte('payment_date', minDate) : empty,
      glassCodes.length ? supabase.from('glass_payments').select('client_code, payment_date, amount').in('client_code', glassCodes).gte('payment_date', minDate) : empty,
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tally = (rows: any[], type: string) => {
      const byClient = new Map<string, Array<{ d: string; a: number }>>();
      for (const r of rows || []) {
        const k = r.client_code;
        if (!byClient.has(k)) byClient.set(k, []);
        byClient.get(k)!.push({ d: String(r.payment_date || '').slice(0, 10), a: Number(r.amount) || 0 });
      }
      for (const it of promised.filter((p) => p.client_type === type)) {
        const from = minusDays(it.promised_date!, GRACE_DAYS); // 약속일 14일 전 입금부터 인정(조기 입금 포함)
        const sum = (byClient.get(it.client_code) || [])
          .filter((x) => x.d >= from)
          .reduce((s, x) => s + x.a, 0);
        it.promised_paid = sum; // 부분 입금도 항목에 기록 → 문구에서 차액 안내
        if (sum >= (it.promised_amount || 0) - 1) fulfilled.add(`${it.client_code}|${it.client_type}`);
      }
    };
    tally(wp.data || [], 'wine');
    tally(gp.data || [], 'glass');
  }

  const promiseToday: CollItem[] = [], broken: CollItem[] = [], overdue: CollItem[] = [];
  for (const it of all) {
    if (it.status === 'paid' || it.net_balance <= 0) continue;
    // 약속금액 입금 완료 → '약속(오늘 약속·약속어김)'에서만 제외.
    // 단 미수가 남아 연체면 '연체'에는 계속 표기(약속 이행이 잔여 미수까지 없애면 안 됨).
    const promiseDone = fulfilled.has(`${it.client_code}|${it.client_type}`);
    if (!promiseDone && it.promised_date === today) { promiseToday.push(it); continue; }
    if (!promiseDone && it.promised_date && it.promised_date < today) { broken.push(it); continue; }
    if (it.overdue > 0) overdue.push(it);
  }
  const byOverdue = (a: CollItem, b: CollItem) => b.overdue - a.overdue || b.days_overdue - a.days_overdue;
  promiseToday.sort((a, b) => b.net_balance - a.net_balance);
  broken.sort(byOverdue);
  overdue.sort(byOverdue);

  return {
    today, promiseToday, broken, overdue,
    counts: {
      promiseToday: promiseToday.length, broken: broken.length,
      overdue: overdue.length, special: overdue.filter(o => o.special).length,
    },
    sender: { manager, title: senderRow.data?.title ?? null },
  };
}

// 알림(텔레그램/알림톡)용 요약 — 브리핑과 동일 데이터에서 파생 (화면과 숫자 일치 보장)
export interface ManagerCollectionSummary {
  manager: string;
  promiseToday: number;
  broken: number;
  overdue: number;
  special: number;
  total: number;       // 오늘 약속 + 약속어김 + 연체 (화면의 '오늘 챙길' 전체)
  topName: string;
  topAmount: number;
}

export async function buildManagerSummary(manager: string, asOf = kstToday()): Promise<ManagerCollectionSummary> {
  const b = await buildCollectionBriefing(manager, asOf);
  // 사용자가 브리핑에서 숨김 처리한 거래처는 알림에서도 제외 (화면과 숫자 일치)
  const vis = (arr: CollItem[]) => arr.filter((it) => !it.hidden);
  const promiseToday = vis(b.promiseToday), broken = vis(b.broken), overdue = vis(b.overdue);
  const items = [...promiseToday, ...broken, ...overdue];
  let topName = '', topAmount = 0;
  for (const it of items) {
    const amount = it.overdue > 0 ? it.overdue : it.net_balance;
    if (amount > topAmount) { topAmount = amount; topName = it.client_name; }
  }
  return {
    manager,
    promiseToday: promiseToday.length,
    broken: broken.length,
    overdue: overdue.length,
    special: overdue.filter((o) => o.special).length,
    total: items.length,
    topName, topAmount,
  };
}
