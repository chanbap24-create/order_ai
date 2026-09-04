import { supabase } from '@/app/lib/db';

/**
 * 품목 dismiss/restore 처리.
 *  - dismiss: 현재 재고 스냅샷과 함께 기록 (기존 레코드는 UPDATE, 신규는 INSERT)
 *  - restore: 해당 item_no의 dismissed 레코드 삭제
 */
export async function dismissItems(
  item_nos: string[],
  items?: { item_no: string; item_name?: string }[],
): Promise<{ dismissed: number; errors: string[] }> {
  const nameMap = new Map<string, string>();
  if (items && Array.isArray(items)) {
    for (const it of items) nameMap.set(it.item_no, it.item_name || '');
  }

  // Phase 1: 재고 + 기존 alert 레코드 병렬 조회
  const [invResults, existingResults] = await Promise.all([
    (async () => {
      const m = new Map<string, number>();
      for (let i = 0; i < item_nos.length; i += 500) {
        const batch = item_nos.slice(i, i + 500);
        const { data } = await supabase
          .from('inventory_cdv')
          .select('item_no, stock_total')
          .in('item_no', batch);
        for (const inv of data || []) {
          m.set(inv.item_no, Number(inv.stock_total) || 0);
        }
      }
      return m;
    })(),
    (async () => {
      const s = new Set<string>();
      for (let i = 0; i < item_nos.length; i += 500) {
        const batch = item_nos.slice(i, i + 500);
        const { data } = await supabase
          .from('inventory_alerts')
          .select('item_no')
          .in('item_no', batch);
        for (const r of data || []) s.add(r.item_no);
      }
      return s;
    })(),
  ]);

  const now = new Date().toISOString();
  const existingNos = item_nos.filter((n) => existingResults.has(n));
  const newNos = item_nos.filter((n) => !existingResults.has(n));

  const errors: string[] = [];

  // Phase 2: 기존 UPDATE 병렬 + 신규 INSERT 일괄
  if (existingNos.length > 0) {
    const updatePromises = existingNos.map((itemNo) => {
      const itemName = nameMap.get(itemNo) || '';
      const currentStock = invResults.get(itemNo) ?? 0;
      return supabase
        .from('inventory_alerts')
        .update({
          status: 'dismissed',
          dismissed_at: now,
          current_stock: currentStock,
          ...(itemName ? { item_name: itemName } : {}),
        })
        .eq('item_no', itemNo);
    });
    const updateResults = await Promise.all(updatePromises);
    updateResults.forEach((res, i) => {
      if (res.error) errors.push(`${existingNos[i]}: ${res.error.message}`);
    });
  }

  if (newNos.length > 0) {
    const insertRows = newNos.map((itemNo) => ({
      item_no: itemNo,
      item_name: nameMap.get(itemNo) || '',
      alert_type: 'out_of_stock',
      current_stock: invResults.get(itemNo) ?? 0,
      threshold: 0,
      affected_clients: [],
      status: 'dismissed',
      dismissed_at: now,
    }));
    const { error: insErr } = await supabase.from('inventory_alerts').insert(insertRows);
    if (insErr) errors.push(`insert: ${insErr.message}`);
  }

  return {
    dismissed: item_nos.length - errors.length,
    errors,
  };
}

export async function restoreItems(item_nos: string[]): Promise<{ restored: number; error?: string }> {
  const { error: delErr } = await supabase
    .from('inventory_alerts')
    .delete()
    .in('item_no', item_nos)
    .eq('status', 'dismissed');
  if (delErr) {
    console.error('Restore delete error:', delErr);
    return { restored: 0, error: delErr.message };
  }
  return { restored: item_nos.length };
}

/**
 * 제외 품목 목록 조회 (GET).
 */
export async function fetchDismissedList() {
  const { data: dismissed } = await supabase
    .from('inventory_alerts')
    .select('id, item_no, item_name, dismissed_at, created_at')
    .eq('status', 'dismissed')
    .order('dismissed_at', { ascending: false });

  if (!dismissed || dismissed.length === 0) {
    return { items: [], total: 0 };
  }

  const itemNos = dismissed.map((d) => d.item_no);
  const [{ data: invData }, { data: wineData }] = await Promise.all([
    supabase.from('inventory_cdv').select('item_no, item_name, country, supply_price, stock_total').in('item_no', itemNos),
    supabase.from('wines').select('item_code, item_name_kr, country, wine_type, region').in('item_code', itemNos),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invMap = new Map<string, any>();
  for (const inv of invData || []) invMap.set(inv.item_no, inv);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wineMap = new Map<string, any>();
  for (const w of wineData || []) wineMap.set(w.item_code, w);

  const items = dismissed.map((d) => {
    const inv = invMap.get(d.item_no);
    const wine = wineMap.get(d.item_no);
    const totalStock = inv ? (Number(inv.stock_total) || 0) : 0;
    return {
      id: d.id,
      item_no: d.item_no,
      item_name: wine?.item_name_kr || inv?.item_name || d.item_name || d.item_no,
      country: wine?.country || inv?.country || '',
      wine_type: wine?.wine_type || '',
      supply_price: inv?.supply_price || 0,
      current_stock: totalStock,
      dismissed_at: d.dismissed_at || d.created_at,
    };
  });

  return { items, total: items.length };
}
