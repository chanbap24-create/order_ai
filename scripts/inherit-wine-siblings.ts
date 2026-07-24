// 재고표의 미등록 와인 중 "빈티지 자리만 다른 형제"가 wines에 있는 품목을 자동 승계 등록.
// 형제 = 품번에서 3~4자리(빈티지)를 뺀 나머지가 같은 와인. (예: 3610007 ← 3614007)
// 매장(백화점) 재고가 있는 품목만 대상 — 죽은 재고(불량·단종·누주·반품뿐)는 제외.
// 실행: npx tsx --env-file=.env.local scripts/inherit-wine-siblings.ts [--dry]
import { supabase } from '../app/lib/db';
import { extractVintage } from '../app/api/quote/lib/enrichment';

const DRY = process.argv.includes('--dry');
const mask = (c: string) => (c && c.length === 7 ? c.slice(0, 2) + c.slice(4) : null);

// 노트에서 승계할 필드 — 빈티지 특정적인 vintage_note·awards는 제외
const NOTE_FIELDS = [
  'color_note', 'nose_note', 'palate_note', 'food_pairing', 'glass_pairing', 'serving_temp',
  'winemaking', 'winery_description', 'aging_potential', 'flavor_tags',
  'wine_type', 'country', 'region', 'grape_varieties', 'ai_generated',
] as const;

async function main() {
  // 1) 재고 전체 + 등록 여부
  const inv: Record<string, unknown>[] = [];
  for (let f = 0; ; f += 1000) {
    const { data } = await supabase.from('inventory_cdv').select('*').range(f, f + 999);
    inv.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const known = new Set<string>();
  const allWineCodes: string[] = [];
  for (let f = 0; ; f += 1000) {
    const { data } = await supabase.from('wines').select('item_code').range(f, f + 999);
    for (const w of data || []) { known.add(w.item_code); allWineCodes.push(w.item_code); }
    if (!data || data.length < 1000) break;
  }

  // 2) 대상: 미등록 + 매장 재고>0 + 7자리 품번 + 형제 존재
  const storeStock = (r: Record<string, unknown>) =>
    ['store_hyundai_main', 'store_hyundai_jungdong', 'store_hyundai_trade', 'store_ssg_gangnam', 'store_thehyundai']
      .reduce((s, c) => s + (Number(r[c]) || 0), 0);
  const siblingsByMask = new Map<string, string[]>();
  for (const c of allWineCodes) {
    const m = mask(c);
    if (m) (siblingsByMask.get(m) ?? siblingsByMask.set(m, []).get(m)!).push(c);
  }
  // 판촉물·집기류 가드 — 형제 매칭이 있어도 와인이 아니면 제외
  const NON_WINE = /집기|케이스|쇼핑백|지함|버켓|버킷|글라스|오프너|스토퍼|택배|박스|디스플레이|더미|브로셔|책자|포스터|스탠드|쿠션|가방|에어팩|코스터|진열|폴더|나이프|키링|모자|담요|튜브|소품|선반|와인렉|PACKING|PALLET|리델/i;
  const targets = inv.filter((r) => {
    const code = String(r.item_no || '');
    if (NON_WINE.test(String(r.item_name || ''))) return false;
    return !known.has(code) && storeStock(r) > 0 && mask(code) && siblingsByMask.has(mask(code)!);
  });
  console.log(`승계 대상: ${targets.length}종${DRY ? ' (dry-run)' : ''}`);

  let done = 0, noteCopied = 0;
  for (const r of targets) {
    const code = String(r.item_no);
    const sibCodes = siblingsByMask.get(mask(code)!)!;
    // 형제 중 향미 태그 있는 노트 보유 와인 우선
    const { data: sibNotes } = await supabase
      .from('tasting_notes').select('*').in('wine_id', sibCodes);
    const bestNote = (sibNotes || []).sort((a, b) =>
      (Array.isArray(b.flavor_tags) ? b.flavor_tags.length : 0) - (Array.isArray(a.flavor_tags) ? a.flavor_tags.length : 0))[0];
    const sibCode = bestNote?.wine_id || sibCodes[0];
    const { data: sib } = await supabase.from('wines').select('*').eq('item_code', sibCode).maybeSingle();
    if (!sib) continue;

    const wineRow = {
      item_code: code,
      item_name_kr: sib.item_name_kr,
      item_name_en: sib.item_name_en,
      country: sib.country, country_en: sib.country_en,
      region: sib.region, grape_varieties: sib.grape_varieties,
      wine_type: sib.wine_type, alcohol: sib.alcohol,
      brand: sib.brand, supplier: sib.supplier, supplier_kr: sib.supplier_kr,
      image_url: sib.image_url,
      vintage: extractVintage(code) || sib.vintage,
      supply_price: Number(r.supply_price) || null,
      available_stock: Number(r.available_stock) || 0,
      status: 'active',
      ai_researched: sib.ai_researched,
    };
    if (DRY) {
      console.log(`[dry] ${code} ← ${sibCode} | ${sib.item_name_kr} | 빈티지 ${wineRow.vintage} | 노트 ${bestNote ? 'O' : 'X'}`);
      continue;
    }
    const { error: we } = await supabase.from('wines').upsert(wineRow, { onConflict: 'item_code' });
    if (we) { console.error(`${code} wines 실패:`, we.message); continue; }

    if (bestNote) {
      const noteRow: Record<string, unknown> = { wine_id: code };
      for (const f of NOTE_FIELDS) noteRow[f] = bestNote[f];
      const { error: ne } = await supabase.from('tasting_notes').upsert(noteRow, { onConflict: 'wine_id' });
      if (ne) console.error(`${code} 노트 실패:`, ne.message);
      else noteCopied++;
    }
    done++;
    console.log(`${code} ← ${sibCode} | ${sib.item_name_kr} | 빈티지 ${wineRow.vintage}${bestNote ? ' +노트' : ''}`);
  }
  console.log(`완료: wines ${done}건, 노트 승계 ${noteCopied}건`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
