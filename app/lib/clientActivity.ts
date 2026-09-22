// 거래처 활성 판정 — "최근 출고가 있는가" 단일 정의.
// 검색 드롭다운에서 안 쓰는 옛 거래처(폐업·재채번 잔재)가 살아있는 거래처를 가리는 문제 해결용.
// 법인 분리: 와인=shipments, 글라스=glass_shipments.
import { supabase } from './db';

export const ACTIVE_MONTHS = 24;

/** codes 중 최근 N개월 내 출고가 있는 거래처 코드 집합 */
export async function activeClientCodes(
  codes: string[],
  tab: 'CDV' | 'DL',
  months = ACTIVE_MONTHS,
): Promise<Set<string>> {
  const out = new Set<string>();
  const uniq = [...new Set(codes.filter(Boolean))];
  if (uniq.length === 0) return out;
  const table = tab === 'DL' ? 'glass_shipments' : 'shipments';
  const cutoff = new Date(Date.now() - months * 30 * 86400_000).toISOString().slice(0, 10);
  for (let i = 0; i < uniq.length; i += 150) {
    const { data } = await supabase.from(table)
      .select('client_code')
      .in('client_code', uniq.slice(i, i + 150))
      .gte('ship_date', cutoff)
      .limit(1000);
    for (const r of data || []) out.add(String(r.client_code));
  }
  return out;
}

/** 검색 결과 정렬·압축: 활성(최근 출고) 우선, 활성이 충분하면 비활성은 잘라낸다.
 *  keepInactiveMin: 활성 결과가 이보다 적으면 비활성도 남김(신규·오랜만 거래처 검색 대비). */
export async function rankByActivity<T extends { client_code: string }>(
  list: T[],
  tab: 'CDV' | 'DL',
  opts?: { cap?: number; keepInactiveMin?: number },
): Promise<(T & { active: boolean })[]> {
  const cap = opts?.cap ?? 15;
  const keepMin = opts?.keepInactiveMin ?? 5;
  const active = await activeClientCodes(list.map((c) => c.client_code), tab);
  const marked = list.map((c) => ({ ...c, active: active.has(c.client_code) }));
  const act = marked.filter((c) => c.active);
  const inact = marked.filter((c) => !c.active);
  // 활성 우선 배치. 활성이 충분하면 비활성(죽은 코드)은 노출하지 않음.
  const tail = act.length >= keepMin ? [] : inact.slice(0, Math.max(0, cap - act.length));
  return [...act, ...tail].slice(0, cap);
}
