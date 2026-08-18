// 와인리스트 Excel 생성 (어드민·세일즈 공용). 와인 조회 + 큐레이션 필터 + ExcelJS 생성.
// 재고는 inventory_cdv.available_stock(엑셀 L열=실재고) 우선, 없으면 wines 폴백.
import { supabase } from '@/app/lib/db';
import { loadBrandSupplierMap, supplierFromMap } from '@/app/lib/brandMapping';
import { sanitizeFilterValue } from '@/app/lib/validation';
import { isNonOrderable } from '@/app/lib/catalogFilter';
import { getItemCategory } from '@/app/inventory/constants/categories';
import { extractVintage } from '@/app/api/quote/lib/enrichment';
import ExcelJS from 'exceljs';

export const DEFAULT_WINE_MIN_STOCK = { u20k: 120, u50k: 60, u100k: 24, u200k: 12, over: 1 };

// 세일즈 와인리스트에서 수동 제외할 품번 (실상품이지만 리스트 노출 원치 않음)
const WINE_LIST_EXCLUDE_CODES = new Set<string>([
  '2014533', // 르로아(메) 쇼레 레 본
]);

export interface WineExportOpts {
  search?: string;
  country?: string;
  hideZero?: boolean;
  minStock?: Record<string, number> | null;
}

type WineRow = {
  item_code: string; item_name_kr?: string; item_name_en?: string;
  country?: string; country_en?: string; region?: string; brand?: string;
  supplier?: string; supplier_kr?: string; vintage?: string;
  supply_price?: number; available_stock?: number | null;
};

/** 와인리스트 선별 규칙(공통) — 검색/국가/비상품/공급가/실재고/가격대별 최소재고 필터를
 *  통과한 와인 목록. 엑셀·브랜드북이 같은 규칙을 공유한다. supply_price는 inventory 보정값. */
export async function selectWineListWines(opts: WineExportOpts): Promise<WineRow[]> {
  const search = opts.search || '';
  const country = opts.country || '';
  const hideZero = !!opts.hideZero;
  const minStock = opts.minStock || null;

  // 전체 와인 배치 로드
  const PAGE_SIZE = 1000;
  const { count } = await supabase.from('wines').select('*', { count: 'exact', head: true });
  const totalRows = count || 0;
  let allWines: WineRow[] = [];
  for (let off = 0; off < totalRows; off += PAGE_SIZE) {
    let q = supabase.from('wines')
      .select('item_code, item_name_kr, item_name_en, country, country_en, region, brand, supplier, supplier_kr, vintage, supply_price, available_stock');
    if (search) {
      const safe = sanitizeFilterValue(search);
      q = q.or(`item_code.ilike.%${safe}%,item_name_kr.ilike.%${safe}%,item_name_en.ilike.%${safe}%,brand.ilike.%${safe}%,country.ilike.%${safe}%,country_en.ilike.%${safe}%`);
    }
    if (country) {
      const safeCountry = sanitizeFilterValue(country);
      q = q.or(`country.eq.${safeCountry},country_en.eq.${safeCountry}`);
    }
    q = q.range(off, off + PAGE_SIZE - 1);
    const { data } = await q;
    allWines.push(...((data || []) as WineRow[]));
  }

  // 실재고 + 보세
  const codes = allWines.map(w => w.item_code);
  const bondedMap = new Map<string, number>();
  const availMap = new Map<string, number | null>();
  const priceMap = new Map<string, number>();
  for (let i = 0; i < codes.length; i += 1000) {
    const { data: invRows } = await supabase.from('inventory_cdv').select('item_no, available_stock, bonded_warehouse, bonded_kctc, supply_price').in('item_no', codes.slice(i, i + 1000));
    for (const r of (invRows || [])) {
      bondedMap.set(r.item_no, (r.bonded_warehouse || 0) + (r.bonded_kctc || 0));
      availMap.set(r.item_no, r.available_stock);
      if (r.supply_price) priceMap.set(r.item_no, r.supply_price);
    }
  }
  const realAvail = (w: WineRow): number => availMap.get(w.item_code) ?? (w.available_stock ?? 0);
  // 공급가도 실재고처럼 inventory_cdv(엑셀 업로드값) 우선 — wines.supply_price 는 0/구값이라
  // '5천 이하 제외'·가격대 필터에 잘못 걸려 정상 품목이 리스트에서 누락되던 문제 방지.
  for (const w of allWines) { const p = priceMap.get(w.item_code); if (p && p > 0) w.supply_price = p; }

  if (hideZero) allWines = allWines.filter(w => realAvail(w) + (bondedMap.get(w.item_code) || 0) > 0);

  // 공통 제외: 비상품(포장/케이스/더미 등), 공급가 5천 이하, 국가 미표기, 실재고 0(보세만)
  allWines = allWines.filter(w => {
    const price = w.supply_price || 0;
    if (WINE_LIST_EXCLUDE_CODES.has(w.item_code)) return false;
    if (isNonOrderable(w.item_code, w.item_name_kr || w.item_name_en || '', 'CDV')) return false;
    if (price <= 5000 || !(w.country_en || w.country)) return false;
    if (realAvail(w) <= 0) return false;
    return true;
  });

  // 가격대별 최소재고: minStock 있으면 가격대별 임계치, 없으면 기본(10만↓ 10병 미만 제외)
  allWines = allWines.filter(w => {
    const price = w.supply_price || 0;
    const avail = realAvail(w);
    if (minStock) {
      const need = price <= 20000 ? (minStock.u20k || 0)
        : price <= 50000 ? (minStock.u50k || 0)
        : price <= 100000 ? (minStock.u100k || 0)
        : price <= 200000 ? (minStock.u200k || 0)
        : (minStock.over || 0);
      return avail >= need;
    }
    return !(price <= 100000 && avail < 10);
  });

  return allWines;
}

export async function generateWineListExcel(opts: WineExportOpts): Promise<Buffer> {
  let allWines = await selectWineListWines(opts);

  // 브랜드 약어 → 공급자명 맵 (하드코딩 + 브랜드 자료실)
  const brandMap = await loadBrandSupplierMap();

  // 빈티지 = 품번 3~4자리 공식 우선 (ERP 엑셀 빈티지 컬럼 오입력 방지).
  // 코드가 연도를 못 주면 저장 빈티지로 폴백.
  for (const w of allWines) {
    const fromCode = extractVintage(w.item_code); // '20YY'|'19YY'|'NV'|'MV'|'XX'|2자|''
    if (/^(19|20)\d{2}$/.test(fromCode)) { w.vintage = fromCode; continue; }
    if (fromCode === 'NV' || fromCode === 'MV') { w.vintage = 'NV'; continue; }
    const v = (w.vintage || '').toString().trim().toLowerCase();
    if (!v || v === 'xx' || v === 'nv') w.vintage = 'NV';
    else if (/^\d{2}$/.test(v)) w.vintage = (parseInt(v, 10) < 50 ? '20' : '19') + v;
  }

  // 10만원 이하 동일 품목명: 최신 빈티지만 유지
  const nameGroup = new Map<string, WineRow[]>();
  const kept: WineRow[] = [];
  for (const w of allWines) {
    if ((w.supply_price || 0) > 100000) { kept.push(w); }
    else {
      const key = w.item_name_kr || w.item_code;
      if (!nameGroup.has(key)) nameGroup.set(key, []);
      nameGroup.get(key)!.push(w);
    }
  }
  for (const [, group] of nameGroup) {
    if (group.length === 1) kept.push(group[0]);
    else {
      group.sort((a, b) => {
        const va = a.vintage === 'NV' ? 0 : parseInt(a.vintage || '', 10) || 0;
        const vb = b.vintage === 'NV' ? 0 : parseInt(b.vintage || '', 10) || 0;
        return vb - va;
      });
      kept.push(group[0]);
    }
  }
  allWines = kept;

  // 품번 중복 제거
  const seen = new Set<string>();
  allWines = allWines.filter(w => { if (seen.has(w.item_code)) return false; seen.add(w.item_code); return true; });

  for (const w of allWines) {
    if (w.country_en === 'United States') w.country_en = 'USA';
    if (w.country === 'United States') w.country = 'USA';
  }

  // 커스텀 정렬 (국가 → 브랜드 → 가격)
  const COUNTRY_ORDER: Record<string, number> = {
    'England': 0, '영국': 0, 'France': 1, '프랑스': 1, 'Italy': 2, '이탈리아': 2, '이태리': 2, 'Spain': 3, '스페인': 3,
    'Portugal': 4, '포르투갈': 4, 'USA': 5, 'United States': 5, '미국': 5, 'Chile': 6, '칠레': 6, 'Argentina': 7, '아르헨티나': 7,
    'Australia': 8, '호주': 8, 'NewZealand': 9, 'New Zealand': 9, '뉴질랜드': 9,
  };
  const BRAND_ORDER: Record<string, number> = {
    RF:0,CH:1,SU:2,LG:3,CP:4,HG:5,MA:6,WM:7,VA:8,DA:9,LR:10,BL:11,DD:12,VG:13,RB:14,MG:15,CC:16,LM:17,CL:18,JP:19,
    DF:20,CD:21,GA:22,DP:23,CF:24,MD:25,CA:26,PE:27,BO:28,AS:29,EF:30,VP:31,OR:32,BS:33,AT:34,IG:35,MM:36,JC:37,SM:38,ST:39,
    CO:40,GH:41,BM:42,LS:43,FP:44,AR:45,LT:46,FL:47,PS:48,RG:49,RE:50,RT:51,SV:52,CR:53,RL:54,PF:55,GC:56,GF:57,MB:58,AD:59,
    PR:60,AC:61,LB:62,SS:63,HP:64,EM:65,CK:66,RO:67,LC:68,
  };
  allWines.sort((a, b) => {
    const co = (COUNTRY_ORDER[a.country_en || a.country || ''] ?? 99) - (COUNTRY_ORDER[b.country_en || b.country || ''] ?? 99);
    if (co !== 0) return co;
    const br = (BRAND_ORDER[(a.brand || '').toUpperCase()] ?? 999) - (BRAND_ORDER[(b.brand || '').toUpperCase()] ?? 999);
    if (br !== 0) return br;
    return (b.supply_price || 0) - (a.supply_price || 0);
  });

  // ── 엑셀 생성 ──
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CavedeVin'; wb.created = new Date();
  const ws = wb.addWorksheet('와인리스트', { views: [{ state: 'frozen', ySplit: 2 }] });
  const C = { burgundy: 'FF8B1538', burgundyLight: 'FFF2E6EA', white: 'FFFFFFFF', black: 'FF1E293B', gray: 'FF6B7280', grayLight: 'FFF9FAFB', border: 'FFE5E7EB', borderDark: 'FFD1D5DB' };
  const fontBase: Partial<ExcelJS.Font> = { name: 'Arial', size: 10 };
  const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: C.border } }, bottom: { style: 'thin', color: { argb: C.border } },
    left: { style: 'thin', color: { argb: C.border } }, right: { style: 'thin', color: { argb: C.border } },
  };

  ws.mergeCells('A1:I1');
  const today = new Date().toISOString().slice(0, 10);
  const titleCell = ws.getCell('A1');
  titleCell.value = `CavedeVin Wine List  —  ${today}`;
  titleCell.font = { ...fontBase, size: 13, bold: true, color: { argb: C.burgundy } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.burgundyLight } };
  ws.getRow(1).height = 32;

  const columns = [
    { header: '품번', key: 'item_code', width: 10 }, { header: '국가', key: 'country', width: 14 },
    { header: '지역', key: 'region', width: 20 }, { header: '공급자명', key: 'supplier', width: 24 },
    { header: '영문명', key: 'name_en', width: 42 }, { header: '한글명', key: 'name_kr', width: 36 },
    { header: '빈티지', key: 'vintage', width: 9 }, { header: '타입', key: 'wine_type', width: 10 },
    { header: '공급가', key: 'price', width: 13 },
  ];
  ws.columns = columns.map(c => ({ key: c.key, width: c.width }));

  const headerRow = ws.getRow(2);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { ...fontBase, size: 10, bold: true, color: { argb: C.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.burgundy } };
    cell.alignment = { vertical: 'middle', horizontal: col.key === 'price' ? 'right' : 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: C.burgundy } }, bottom: { style: 'medium', color: { argb: C.burgundy } },
      left: { style: 'thin', color: { argb: 'FF6B1030' } }, right: { style: 'thin', color: { argb: 'FF6B1030' } },
    };
  });
  headerRow.height = 22;

  let prevCountry = '';
  for (let i = 0; i < allWines.length; i++) {
    const w = allWines[i];
    const countryName = w.country_en || w.country || '';
    const isNewCountry = countryName !== prevCountry;
    prevCountry = countryName;
    const row = ws.addRow({
      item_code: w.item_code, country: countryName, region: w.region || '',
      supplier: w.supplier || w.supplier_kr || supplierFromMap(w.brand || null, brandMap)?.en || '',
      name_en: w.item_name_en || '', name_kr: w.item_name_kr || '', vintage: w.vintage || '',
      wine_type: getItemCategory(w.item_code),
      price: w.supply_price || null,
    });
    const bgColor = i % 2 === 0 ? C.white : C.grayLight;
    row.height = 18;
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = { ...fontBase, size: 10, color: { argb: C.black } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.border = borderThin;
      cell.alignment = { vertical: 'middle' };
      if (colNum === 1) { cell.font = { ...fontBase, size: 9, color: { argb: C.gray } }; cell.alignment = { vertical: 'middle', horizontal: 'center' }; cell.numFmt = '@'; }
      if (colNum === 9) { cell.alignment = { vertical: 'middle', horizontal: 'right' }; cell.numFmt = '#,##0'; }
      if (colNum === 8) { cell.alignment = { vertical: 'middle', horizontal: 'center' }; cell.font = { ...fontBase, size: 10, color: { argb: C.gray } }; cell.numFmt = '@'; }
      if (colNum === 7) { cell.alignment = { vertical: 'middle', horizontal: 'center' }; cell.font = { ...fontBase, size: 10, color: { argb: C.gray } }; cell.numFmt = '@'; }
      if (colNum === 2) { cell.font = { ...fontBase, size: 10, bold: isNewCountry, color: { argb: isNewCountry ? C.burgundy : C.gray } }; }
    });
    if (isNewCountry && i > 0) {
      row.eachCell({ includeEmpty: true }, (cell) => { cell.border = { ...borderThin, top: { style: 'medium', color: { argb: C.borderDark } } }; });
    }
  }

  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } };
  ws.autoFilter = { from: 'A2', to: `I${allWines.length + 2}` };
  ws.getColumn(1).hidden = true;

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
