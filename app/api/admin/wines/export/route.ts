// GET /api/admin/wines/export - 와인리스트 엑셀 다운로드
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/db";
import { getSupplierByBrand } from "@/app/lib/brandMapping";
import ExcelJS from "exceljs";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const hideZero = url.searchParams.get("hideZero") === "1";
    const search = url.searchParams.get("search") || "";
    const country = url.searchParams.get("country") || "";

    // 전체 와인 배치 로드
    const PAGE_SIZE = 1000;
    const { count } = await supabase.from('wines').select('*', { count: 'exact', head: true });
    const totalRows = count || 0;
    let allWines: any[] = [];

    for (let off = 0; off < totalRows; off += PAGE_SIZE) {
      let q = supabase.from('wines')
        .select('item_code, item_name_kr, item_name_en, country, country_en, region, brand, supplier, supplier_kr, vintage, supply_price, available_stock');
      if (search) {
        const term = `%${search}%`;
        q = q.or(`item_code.ilike.${term},item_name_kr.ilike.${term},item_name_en.ilike.${term},brand.ilike.${term},country.ilike.${term},country_en.ilike.${term}`);
      }
      if (country) q = q.or(`country.eq.${country},country_en.eq.${country}`);
      q = q.range(off, off + PAGE_SIZE - 1);
      const { data } = await q;
      allWines.push(...(data || []));
    }

    // 보세 수량 조회
    const codes = allWines.map(w => w.item_code);
    const bondedMap = new Map<string, number>();
    for (let i = 0; i < codes.length; i += 1000) {
      const batch = codes.slice(i, i + 1000);
      const { data: invRows } = await supabase.from('inventory_cdv').select('item_no, bonded_warehouse').in('item_no', batch);
      for (const r of (invRows || [])) bondedMap.set(r.item_no, r.bonded_warehouse || 0);
    }

    // hideZero 필터
    if (hideZero) {
      allWines = allWines.filter(w => {
        const stock = (w.available_stock || 0) + (bondedMap.get(w.item_code) || 0);
        return stock > 0;
      });
    }

    // 필터: 공급가 5000원 이하, 국가 미표기, 5만원 이하+재고 10병 미만 제외
    allWines = allWines.filter(w => {
      const price = w.supply_price || 0;
      const stock = (w.available_stock || 0) + (bondedMap.get(w.item_code) || 0);
      const hasCountry = !!(w.country_en || w.country);
      if (price <= 5000 || !hasCountry) return false;
      if (price <= 100000 && stock < 10) return false;
      if ((w.available_stock || 0) <= 0) return false; // 보세에만 있는 와인 제외
      return true;
    });

    // 빈티지 변환: 공백/xx→NV, 2자리→4자리 (<50: 20xx, ≥50: 19xx)
    for (const w of allWines) {
      const v = (w.vintage || '').toString().trim().toLowerCase();
      if (!v || v === 'xx' || v === 'nv') {
        w.vintage = 'NV';
      } else if (/^\d{2}$/.test(v)) {
        const num = parseInt(v, 10);
        w.vintage = (num < 50 ? '20' : '19') + v;
      }
    }

    // 10만원 이하 동일 품목명: 최신 빈티지만 유지
    const nameGroup = new Map<string, any[]>();
    const kept: any[] = [];
    for (const w of allWines) {
      if ((w.supply_price || 0) > 100000) {
        kept.push(w);
      } else {
        const key = w.item_name_kr || w.item_code;
        if (!nameGroup.has(key)) nameGroup.set(key, []);
        nameGroup.get(key)!.push(w);
      }
    }
    for (const [, group] of nameGroup) {
      if (group.length === 1) {
        kept.push(group[0]);
      } else {
        // NV는 가장 낮은 순위, 숫자가 큰(최신)게 우선
        group.sort((a: any, b: any) => {
          const va = a.vintage === 'NV' ? 0 : parseInt(a.vintage, 10) || 0;
          const vb = b.vintage === 'NV' ? 0 : parseInt(b.vintage, 10) || 0;
          return vb - va;
        });
        kept.push(group[0]);
      }
    }
    allWines = kept;

    // 품번 중복 제거
    const seen = new Set<string>();
    allWines = allWines.filter(w => {
      if (seen.has(w.item_code)) return false;
      seen.add(w.item_code);
      return true;
    });

    // 커스텀 정렬 (국가 → 브랜드 → 가격)
    const COUNTRY_ORDER: Record<string, number> = {
      'England': 0, '영국': 0, 'France': 1, '프랑스': 1,
      'Italy': 2, '이탈리아': 2, '이태리': 2, 'Spain': 3, '스페인': 3,
      'Portugal': 4, '포르투갈': 4, 'USA': 5, '미국': 5,
      'Chile': 6, '칠레': 6, 'Argentina': 7, '아르헨티나': 7,
      'Australia': 8, '호주': 8, 'NewZealand': 9, 'New Zealand': 9, '뉴질랜드': 9,
    };
    const BRAND_ORDER: Record<string, number> = {
      RF:0,CH:1,SU:2,LG:3,CP:4,HG:5,MA:6,WM:7,VA:8,DA:9,
      LR:10,BL:11,DD:12,VG:13,RB:14,MG:15,CC:16,LM:17,CL:18,JP:19,
      DF:20,CD:21,GA:22,DP:23,CF:24,MD:25,CA:26,PE:27,BO:28,AS:29,
      EF:30,VP:31,OR:32,BS:33,AT:34,IG:35,MM:36,JC:37,SM:38,ST:39,
      CO:40,GH:41,BM:42,LS:43,FP:44,AR:45,LT:46,FL:47,PS:48,RG:49,
      RE:50,RT:51,SV:52,CR:53,RL:54,PF:55,GC:56,GF:57,MB:58,AD:59,
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
    wb.creator = 'CavedeVin';
    wb.created = new Date();
    const ws = wb.addWorksheet('와인리스트', {
      views: [{ state: 'frozen', ySplit: 2 }],
    });

    // 색상 팔레트
    const C = {
      burgundy: 'FF8B1538',
      burgundyLight: 'FFF2E6EA',
      white: 'FFFFFFFF',
      black: 'FF1E293B',
      gray: 'FF6B7280',
      grayLight: 'FFF9FAFB',
      border: 'FFE5E7EB',
      borderDark: 'FFD1D5DB',
    };

    const fontBase: Partial<ExcelJS.Font> = { name: 'Arial', size: 10 };
    const borderThin: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: C.border } },
      bottom: { style: 'thin', color: { argb: C.border } },
      left: { style: 'thin', color: { argb: C.border } },
      right: { style: 'thin', color: { argb: C.border } },
    };

    // ── 타이틀 행 ──
    ws.mergeCells('A1:H1');
    const titleCell = ws.getCell('A1');
    const today = new Date().toISOString().slice(0, 10);
    titleCell.value = `CavedeVin Wine List  —  ${today}`;
    titleCell.font = { ...fontBase, size: 13, bold: true, color: { argb: C.burgundy } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.burgundyLight } };
    ws.getRow(1).height = 32;

    // ── 컬럼 정의 ──
    const columns = [
      { header: '품번', key: 'item_code', width: 10 },
      { header: '국가', key: 'country', width: 14 },
      { header: '지역', key: 'region', width: 20 },
      { header: '공급자명', key: 'supplier', width: 24 },
      { header: '영문명', key: 'name_en', width: 42 },
      { header: '한글명', key: 'name_kr', width: 36 },
      { header: '빈티지', key: 'vintage', width: 9 },
      { header: '공급가', key: 'price', width: 13 },
    ];
    ws.columns = columns.map(c => ({ key: c.key, width: c.width }));

    // ── 헤더 행 (2행) ──
    const headerRow = ws.getRow(2);
    columns.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = col.header;
      cell.font = { ...fontBase, size: 10, bold: true, color: { argb: C.white } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.burgundy } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: col.key === 'price' ? 'right' : 'center',
      };
      cell.border = {
        top: { style: 'thin', color: { argb: C.burgundy } },
        bottom: { style: 'medium', color: { argb: C.burgundy } },
        left: { style: 'thin', color: { argb: 'FF6B1030' } },
        right: { style: 'thin', color: { argb: 'FF6B1030' } },
      };
    });
    headerRow.height = 22;

    // ── 데이터 행 ──
    let prevCountry = '';
    for (let i = 0; i < allWines.length; i++) {
      const w = allWines[i];
      const countryName = w.country_en || w.country || '';
      const isNewCountry = countryName !== prevCountry;
      prevCountry = countryName;

      const row = ws.addRow({
        item_code: w.item_code,
        country: countryName,
        region: w.region || '',
        supplier: w.supplier || w.supplier_kr || getSupplierByBrand(w.brand)?.en || '',
        name_en: w.item_name_en || '',
        name_kr: w.item_name_kr || '',
        vintage: w.vintage || '',
        price: w.supply_price || null,
      });

      const isEven = i % 2 === 0;
      const bgColor = isEven ? C.white : C.grayLight;

      row.height = 18;
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.font = { ...fontBase, size: 10, color: { argb: C.black } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.border = borderThin;
        cell.alignment = { vertical: 'middle' };

        if (colNum === 1) {
          cell.font = { ...fontBase, size: 9, color: { argb: C.gray } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
        if (colNum === 8) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '#,##0';
        }
        if (colNum === 7) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { ...fontBase, size: 10, color: { argb: C.gray } };
        }
        if (colNum === 2) {
          cell.font = { ...fontBase, size: 10, bold: isNewCountry, color: { argb: isNewCountry ? C.burgundy : C.gray } };
        }
      });

      // 국가 구분선
      if (isNewCountry && i > 0) {
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.border = {
            ...borderThin,
            top: { style: 'medium', color: { argb: C.borderDark } },
          };
        });
      }
    }

    // ── 인쇄 설정 ──
    ws.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    };
    ws.autoFilter = { from: 'A2', to: `H${allWines.length + 2}` };
    ws.getColumn(1).hidden = true; // 품번 열 숨김 (숨김 해제로 확인 가능)

    const buffer = await wb.xlsx.writeBuffer();

    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="wine-list_${today}.xlsx"`,
      },
    });
  } catch (e) {
    console.error('[WineExport]', e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
