// Supabase 1000행 캡 우회 공용 유틸 — .range() 반복 조회.
// PostgREST는 select/rpc(SETOF) 결과를 기본 1000행에서 잘라내며 .limit(N>1000)도 못 넘는다.
// 사용:
//   const rows = await fetchAllRows((f, t) => supabase.from('wines').select('a,b').range(f, t));
//   const rows = await fetchAllRows((f, t) => supabase.rpc('calc_wine_aging', args).range(f, t));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RangeQuery<T> = (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>;

export async function fetchAllRows<T>(query: RangeQuery<T>, batch = 1000): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await query(from, from + batch - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < batch) break;
    from += batch;
  }
  return rows;
}
