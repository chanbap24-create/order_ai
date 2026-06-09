/**
 * inventory_cdv 에는 있으나 wines 에 없는 '진짜 와인'만 골라 wines(status=new)로 일괄 등록.
 * 잡품목(포장·판촉·더미·사은품 등) 제외.
 *
 * 사용:
 *   DRY=1 npx tsx scripts/migration/register-missing-wines.ts   # 미리보기(기본)
 *   DRY=0 npx tsx scripts/migration/register-missing-wines.ts   # 실제 등록
 */
import { supabase } from "@/app/lib/db";
import { getCountryPair } from "@/app/lib/countryMapping";
import { getSupplierByBrand } from "@/app/lib/brandMapping";
import { translateWineName } from "@/app/lib/koreanToEnglish";

const DRY = process.env.DRY !== "0";

// 잡품목(비와인) 이름 키워드
const JUNK = /더미|사은품|샘플|쇼핑백|종이|케이스|지함|박스|에어팩|쿠션|캔들|홀더|버켓|아이스|증정|봉투|명절|설\s|추석|본입|택배|무지|키트|글라스|디캔터|오프너|스토퍼|코르크|냅킨|와인잔|병따개|water|mineral|\(X\)|우드\s*케이스/i;

function isRealWine(item: any): boolean {
  const code = String(item.item_no || "");
  const name = String(item.item_name || "");
  if (/^9/.test(code)) return false;       // 9 프리픽스 = 포장/판촉
  if (/^0000/.test(code)) return false;     // 더미 디스플레이병
  if (JUNK.test(name)) return false;        // 잡품목 키워드
  const alc = parseFloat(String(item.alcohol_content || "0"));
  const hasVintage = item.vintage && /\d/.test(String(item.vintage));
  if (alc > 0) return true;                  // 알코올 도수 있으면 와인
  if (hasVintage && item.country) return true; // 또는 빈티지+국가
  return false;
}

function buildRow(item: any) {
  let brandCode: string | null = null;
  let cleanName = item.item_name;
  const m = (item.item_name || "").match(/^([A-Z]{2,4})\s*([가-힣].+)/);
  if (m) { brandCode = m[1]; cleanName = m[2]; }
  const { kr, en } = getCountryPair(item.country || "");
  const sup = getSupplierByBrand(brandCode);
  return {
    item_code: item.item_no,
    item_name_kr: cleanName,
    item_name_en: translateWineName(cleanName),
    brand: brandCode,
    supplier: sup?.en || null,
    supplier_kr: sup?.kr || null,
    country: kr || item.country,
    country_en: en,
    vintage: item.vintage,
    alcohol: item.alcohol_content,
    supply_price: item.supply_price,
    available_stock: item.available_stock,
    status: "new" as const,
  };
}

/** Supabase는 쿼리당 최대 1000행만 반환 → 페이지네이션으로 전체 로드. */
async function fetchAll(table: string, columns: string): Promise<any[]> {
  const all: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
  }
  return all;
}

(async () => {
  const inv = await fetchAll("inventory_cdv", "item_no,item_name,vintage,alcohol_content,country,supply_price,available_stock");
  const win = await fetchAll("wines", "item_code");
  const winSet = new Set(win.map((r: any) => r.item_code));
  console.log(`(로드: inventory ${inv.length} / wines ${win.length})`);

  const missing = inv.filter((r: any) => r.item_no && !winSet.has(r.item_no));
  const wines = missing.filter(isRealWine);
  const excluded = missing.filter((r: any) => !isRealWine(r));

  console.log(`누락 ${missing.length}개 → 와인 ${wines.length}개 / 제외(잡품목) ${excluded.length}개`);
  console.log("\n[등록 대상 샘플 15]");
  wines.slice(0, 15).forEach((r: any) => console.log(`  ${r.item_no}  ${r.item_name}  (v${r.vintage||"-"}, ${r.country||"-"}, alc ${r.alcohol_content||"-"})`));
  console.log("\n[제외 샘플 15]");
  excluded.slice(0, 15).forEach((r: any) => console.log(`  ${r.item_no}  ${r.item_name}`));

  if (DRY) { console.log("\n*** DRY-RUN (미리보기). 실제 등록하려면 DRY=0 ***"); return; }

  const rows = wines.map(buildRow);
  let ok = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from("wines").insert(rows.slice(i, i + 500));
    if (error) { console.log("insert 오류:", error.message); } else { ok += rows.slice(i, i + 500).length; }
  }
  console.log(`\n✅ ${ok}개 등록 완료 (status=new)`);
})().catch((e) => console.error("ERR", e.message));
