import { supabase } from '@/app/lib/db';

export async function fetchAll<T>(table: string, select: string): Promise<T[]> {
  const all: T[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

/* 재고 있는 품목만 서버에서 필터 */
export async function fetchInventoryInStock<T>(select: string): Promise<T[]> {
  const all: T[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('inventory_cdv')
      .select(select)
      .or('available_stock.gt.0,bonded_warehouse.gt.0')
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

/* item_code 집합으로 한정 조회 */
export async function fetchWinesByCodes<T>(codes: string[], select: string): Promise<T[]> {
  if (codes.length === 0) return [];
  const all: T[] = [];
  for (let i = 0; i < codes.length; i += 500) {
    const batch = codes.slice(i, i + 500);
    const { data, error } = await supabase.from('wines').select(select).in('item_code', batch);
    if (error || !data) continue;
    all.push(...(data as T[]));
  }
  return all;
}
