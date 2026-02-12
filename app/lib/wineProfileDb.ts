import { supabase } from './db';

export function ensureWineProfileTable() {
  // no-op: 테이블은 Supabase migration에서 생성됨
}

export async function seedFromInventory() {
  // CDV inventory에서 seed
  try {
    const { data: cdvRows } = await supabase
      .from('inventory_cdv')
      .select('item_no, country')
      .not('item_no', 'eq', '')
      .not('item_no', 'is', null);

    if (cdvRows && cdvRows.length > 0) {
      const rows = cdvRows.map(r => ({
        item_code: r.item_no,
        country: r.country || '',
      }));
      await supabase.from('wine_profiles').upsert(rows, { onConflict: 'item_code', ignoreDuplicates: true });
    }
  } catch { /* 테이블 없으면 무시 */ }

  // DL inventory에서 seed
  try {
    const { data: dlRows } = await supabase
      .from('inventory_dl')
      .select('item_no, country')
      .not('item_no', 'eq', '')
      .not('item_no', 'is', null);

    if (dlRows && dlRows.length > 0) {
      const rows = dlRows.map(r => ({
        item_code: r.item_no,
        country: r.country || '',
      }));
      await supabase.from('wine_profiles').upsert(rows, { onConflict: 'item_code', ignoreDuplicates: true });
    }
  } catch { /* 테이블 없으면 무시 */ }
}
