import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

export const runtime = 'nodejs';

interface InventoryItem {
  item_no: string;
  item_name: string;
  supply_price: number;
  available_stock: number;
  anseong_warehouse: number;
  sales_30days: number;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({
        results: [],
        count: 0,
        query: '',
        message: '검색어를 입력해주세요.'
      });
    }

    // Read Excel file
    const filePath = path.join(process.cwd(), 'order-ai.xlsx');
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Excel 파일을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = 'DL';

    if (!workbook.SheetNames.includes(sheetName)) {
      return NextResponse.json(
        { error: 'DL 시트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const data: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const headers = data[0];

    // Parse rows
    const results: InventoryItem[] = [];
    const searchLower = query.toLowerCase();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Column mapping:
      // B(1): 품목번호
      // C(2): 품명
      // P(15): 공급가
      // L(11): 가용재고
      // X(23): 안성창고
      // M(12): 30일출고
      
      const itemName = String(row[2] || '');
      
      // Search filter
      if (!itemName.toLowerCase().includes(searchLower)) {
        continue;
      }

      const itemNo = String(row[1] || '').trim();
      if (!itemNo) continue;

      results.push({
        item_no: itemNo,
        item_name: itemName,
        supply_price: Number(row[15]) || 0,
        available_stock: Number(row[11]) || 0,
        anseong_warehouse: Number(row[23]) || 0,
        sales_30days: Number(row[12]) || 0
      });
    }

    // Sort by supply_price descending
    results.sort((a, b) => b.supply_price - a.supply_price);

    return NextResponse.json({
      results,
      count: results.length,
      query
    });

  } catch (error: any) {
    console.error('DL 재고 검색 오류:', error);
    return NextResponse.json(
      { error: error.message || '검색 중 오류가 발생했습니다.', details: error.stack },
      { status: 500 }
    );
  }
}
