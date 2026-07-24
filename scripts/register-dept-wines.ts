// 백화점 매장 재고가 있는 미등록 와인을 wines에 기본 등록(+dept_batch 태깅).
// ZK(타사 위탁)는 품명에서 (수입사)·(B)마커·선두 빈티지·말미 입고일을 떼어 정제.
// 이미 등록된 이번 승계분(오늘 생성)도 dept_batch=true로 태깅.
// 실행: npx tsx --env-file=.env.local scripts/register-dept-wines.ts [--dry]
import { supabase } from '../app/lib/db';
import { extractVintage } from '../app/api/quote/lib/enrichment';
import { getCountryPair } from '../app/lib/countryMapping';

const DRY = process.argv.includes('--dry');
const STORE_COLS = ['store_hyundai_main', 'store_hyundai_jungdong', 'store_hyundai_trade', 'store_ssg_gangnam', 'store_thehyundai'];
const NON_WINE = /우드\s?케이스|쇼핑백|지함|버켓|버킷|글라스|오프너|스토퍼|택배|박스|디스플레이|더미|브로셔|책자|포스터|스탠드|쿠션|가방|에어팩|시음\s?부스|행사|집기|코스터|진열|폴더|나이프|키링|모자|담요|튜브|소품|선반|와인렉|세트무지|PACKING|PALLET|리델|^RD |필터|퓨어글라스/i;

/** ZK 품명 정제: "(국순당)(B)17샤또퐁떼까네23/01" → "샤또퐁떼까네" */
function cleanName(raw: string): string {
  let s = (raw || '').trim();
  s = s.replace(/^\([^)]{1,15}\)/, '');          // (수입사)
  s = s.replace(/^\([A-Z]{1,2}\)/, '');          // (B) 같은 마커
  s = s.replace(/^(NV|MV|\d{2})(?=[^\d])/, '');  // 선두 빈티지 (17샤또→샤또)
  s = s.replace(/\d{2}\/\d{2}$/, '');            // 말미 입고일 23/01
  s = s.replace(/\(New\)/i, '');
  return s.trim();
}

async function main() {
  // 매장 재고 있는 재고행
  const inv: Record<string, unknown>[] = [];
  for (let f = 0; ; f += 1000) {
    const { data } = await supabase.from('inventory_cdv').select('*').range(f, f + 999);
    inv.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const storeRows = inv.filter((r) => STORE_COLS.some((c) => Number(r[c]) > 0));
  const known = new Set<string>();
  for (let i = 0; i < storeRows.length; i += 500) {
    const { data: ws } = await supabase.from('wines').select('item_code')
      .in('item_code', storeRows.slice(i, i + 500).map((r) => String(r.item_no)));
    for (const w of ws || []) known.add(w.item_code);
  }
  const isWine = (r: Record<string, unknown>) => {
    if (NON_WINE.test(String(r.item_name || ''))) return false;
    return String(r.unit || '').toUpperCase().includes('B/T') || !!r.vintage || !!r.country;
  };
  const targets = storeRows.filter((r) => !known.has(String(r.item_no)) && isWine(r));
  console.log(`신규 등록 대상: ${targets.length}종${DRY ? ' (dry-run)' : ''}`);

  let done = 0;
  for (const r of targets) {
    const code = String(r.item_no);
    const rawName = String(r.item_name || '');
    const name = cleanName(rawName);
    const { kr, en } = getCountryPair(String(r.country || ''));
    const row = {
      item_code: code,
      item_name_kr: name || rawName,
      country: kr || String(r.country || '') || null,
      country_en: en || null,
      vintage: extractVintage(code) || String(r.vintage || '') || null,
      supply_price: Number(r.supply_price) || null,
      available_stock: Number(r.available_stock) || 0,
      status: 'active',
      dept_batch: true,
      supplier_kr: String(r.importer || '') || null, // 타사면 수입사 표시
    };
    if (DRY) { console.log('[dry]', code, '|', row.item_name_kr, '|', row.vintage, '|', row.country, '|', row.supplier_kr || ''); continue; }
    const { error } = await supabase.from('wines').upsert(row, { onConflict: 'item_code' });
    if (error) { console.error(code, '실패:', error.message); continue; }
    done++;
  }
  console.log(`등록 완료: ${done}건`);

  // 이번에 승계 등록된 것(오늘 생성)도 태깅
  if (!DRY) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data: tagged, error: te } = await supabase.from('wines')
      .update({ dept_batch: true })
      .gte('created_at', today.toISOString())
      .eq('dept_batch', false)
      .select('item_code');
    if (te) console.error('승계분 태깅 실패:', te.message);
    else console.log(`승계분 태깅: ${tagged?.length ?? 0}건`);
    const { count } = await supabase.from('wines').select('*', { count: 'exact', head: true }).eq('dept_batch', true);
    console.log(`dept_batch 총: ${count}건`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
