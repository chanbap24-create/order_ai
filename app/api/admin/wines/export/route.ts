// GET /api/admin/wines/export - 와인리스트 엑셀 다운로드
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/db";
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

    // 엑셀 생성
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('와인리스트');

    ws.columns = [
      { header: '국가', key: 'country', width: 12 },
      { header: '지역', key: 'region', width: 18 },
      { header: '공급자명', key: 'supplier', width: 22 },
      { header: '영문명', key: 'name_en', width: 40 },
      { header: '한글명', key: 'name_kr', width: 35 },
      { header: '빈티지', key: 'vintage', width: 8 },
      { header: '공급가', key: 'price', width: 12 },
    ];

    // 헤더 스타일
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B1538' } };
    headerRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 24;

    for (const w of allWines) {
      ws.addRow({
        country: w.country_en || w.country || '',
        region: w.region || '',
        supplier: w.supplier || w.supplier_kr || '',
        name_en: w.item_name_en || '',
        name_kr: w.item_name_kr || '',
        vintage: w.vintage || '',
        price: w.supply_price || '',
      });
    }

    // 공급가 숫자 포맷
    ws.getColumn('price').numFmt = '#,##0';
    ws.getColumn('price').alignment = { horizontal: 'right' };

    const buffer = await wb.xlsx.writeBuffer();
    const today = new Date().toISOString().slice(0, 10);

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
