// 저장 견적(견적 이력) 도메인 로직. 라우트는 얇게 유지하고 실제 작업은 여기서.
import { supabase } from '@/app/lib/db';
import { releaseStepUp, currentQuarterKey } from '@/app/lib/pricing/stepupLock';

// quote_items 로 복원할 때 쓰는 화이트리스트 컬럼(스냅샷 → 작업 초안)
const QUOTE_ITEM_COLS = [
  'item_code', 'country', 'brand', 'region', 'image_url', 'vintage',
  'product_name', 'english_name', 'korean_name', 'supply_price', 'retail_price',
  'discount_rate', 'discounted_price', 'quantity', 'note', 'tasting_note',
  'min_price', 'spec',
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export interface SaveQuoteInput {
  manager: string;
  client_code?: string | null;
  client_name: string;
  company?: string | null;
  items: AnyRow[];
  doc_settings?: unknown;
  columns?: unknown;
  is_tasting?: boolean; // 시음주 견적(100%할인 1병) 구분
}

/** 현재 견적을 스냅샷으로 저장. 빈 견적은 저장하지 않음. */
export async function saveQuote(input: SaveQuoteInput): Promise<{ id: number }> {
  const items = Array.isArray(input.items) ? input.items : [];
  if (items.length === 0) throw new Error('저장할 견적 항목이 없습니다.');

  const total_supply = items.reduce(
    (s, it) => s + (Number(it.supply_price) || 0) * (Number(it.quantity) || 0),
    0,
  );

  const { data, error } = await supabase
    .from('saved_quotes')
    .insert({
      manager: input.manager || '',
      client_code: input.client_code || null,
      client_name: input.client_name || '',
      company: input.company || null,
      item_count: items.length,
      total_supply,
      items,
      doc_settings: input.doc_settings ?? null,
      columns: input.columns ?? null,
      is_tasting: input.is_tasting ?? false,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data as { id: number };
}

/** KST 하루 범위 [start, end) — created_at(timestamptz) 필터용 */
function kstDayRange(date: string): { start: string; end: string } {
  const next = new Date(new Date(`${date}T00:00:00+09:00`).getTime() + 86400000);
  return { start: `${date}T00:00:00+09:00`, end: next.toISOString() };
}

/** 담당자별 저장 견적 목록(스냅샷 items 제외, 가벼운 메타만). date='YYYY-MM-DD'(KST 발행일) 필터 지원. */
export async function listSavedQuotes(
  manager: string,
  opts: { clientCode?: string; search?: string; date?: string } = {},
): Promise<AnyRow[]> {
  let q = supabase
    .from('saved_quotes')
    .select('id, manager, client_code, client_name, company, item_count, total_supply, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (manager) q = q.eq('manager', manager);
  if (opts.clientCode) q = q.eq('client_code', opts.clientCode);
  if (opts.search) q = q.ilike('client_name', `%${opts.search}%`);
  if (opts.date && /^\d{4}-\d{2}-\d{2}$/.test(opts.date)) {
    const { start, end } = kstDayRange(opts.date);
    q = q.gte('created_at', start).lt('created_at', end);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * 특정 날짜(KST)에 발행된 저장 견적 일괄 삭제 (담당자 스코프).
 * 이번 분기 견적이 포함되면 해당 거래처들의 '하위거래처 보정 분기 1회' 락도 해제(단건 삭제와 동일 정책).
 */
export async function deleteSavedQuotesByDate(
  manager: string,
  date: string,
): Promise<{ deleted: number; stepupReleased: number }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('날짜 형식이 올바르지 않습니다 (YYYY-MM-DD).');
  const { start, end } = kstDayRange(date);

  let q = supabase.from('saved_quotes')
    .select('id, client_code, created_at')
    .gte('created_at', start).lt('created_at', end)
    .limit(1000);
  if (manager) q = q.eq('manager', manager);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data || []) as Array<{ id: number; client_code: string | null; created_at: string }>;
  if (rows.length === 0) return { deleted: 0, stepupReleased: 0 };

  const ids = rows.map((r) => r.id);
  for (let i = 0; i < ids.length; i += 500) {
    const { error: delErr } = await supabase.from('saved_quotes').delete().in('id', ids.slice(i, i + 500));
    if (delErr) throw new Error(delErr.message);
  }

  let stepupReleased = 0;
  const codes = new Set(
    rows.filter((r) => r.client_code && currentQuarterKey(new Date(r.created_at)) === currentQuarterKey())
      .map((r) => r.client_code as string),
  );
  for (const c of codes) {
    if (await releaseStepUp(c)) stepupReleased++;
  }
  return { deleted: rows.length, stepupReleased };
}

/** 단건 조회(스냅샷 items 포함) — 열람/복원용. */
export async function getSavedQuote(id: number): Promise<AnyRow | null> {
  const { data, error } = await supabase.from('saved_quotes').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteSavedQuote(id: number): Promise<void> {
  const { error } = await supabase.from('saved_quotes').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * 저장 견적을 현재 작업 초안(quote_items)으로 복원.
 * 해당 담당자의 기존 초안을 비우고 스냅샷 항목을 재적재한다.
 */
export async function restoreSavedQuote(
  id: number,
  manager: string,
): Promise<{ client_name: string; client_code: string | null; count: number }> {
  const sq = await getSavedQuote(id);
  if (!sq) throw new Error('견적을 찾을 수 없습니다.');
  const items: AnyRow[] = Array.isArray(sq.items) ? sq.items : [];

  // 기존 초안 비우기(담당자 스코프, 미인증이면 전역)
  let del = supabase.from('quote_items').delete();
  del = manager ? del.eq('manager', manager) : del.neq('id', 0);
  const { error: delErr } = await del;
  if (delErr) throw new Error(delErr.message);

  // 스냅샷 → quote_items 재적재(화이트리스트 컬럼만)
  const rows = items.map((it, i) => {
    const row: AnyRow = { sort_order: i, manager: manager || '' };
    for (const col of QUOTE_ITEM_COLS) {
      if (col === 'product_name' || col === 'item_code' || col === 'note' ||
          col === 'tasting_note' || col.endsWith('_name') || col === 'country' ||
          col === 'brand' || col === 'region' || col === 'image_url' ||
          col === 'vintage' || col === 'spec') {
        row[col] = it[col] ?? '';
      } else {
        row[col] = Number(it[col]) || 0;
      }
    }
    return row;
  });
  if (rows.length) {
    const { error } = await supabase.from('quote_items').insert(rows);
    if (error) throw new Error(error.message);
  }
  return { client_name: sq.client_name || '', client_code: sq.client_code ?? null, count: rows.length };
}
