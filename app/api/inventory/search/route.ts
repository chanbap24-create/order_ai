import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import path from 'path';

interface InventoryItem {
  item_no: string;        // B열: 품목번호
  item_name: string;      // C열: 품목명
  supply_price: number;   // P열: 공급가
  available_stock: number; // L열: 가용재고
  bonded_warehouse: number; // V열: 보세창고
  sales_30days: number;   // M열: 30일 출고
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';

    if (!query.trim()) {
      return NextResponse.json({ 
        results: [],
        message: '검색어를 입력해주세요.' 
      });
    }

    // 엑셀 파일 읽기
    const fs = require('fs');
    const excelPath = path.join(process.cwd(), 'order-ai.xlsx');
    const buffer = fs.readFileSync(excelPath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    if (!workbook.SheetNames.includes('Downloads')) {
      return NextResponse.json(
        { error: 'Downloads 시트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const sheet = workbook.Sheets['Downloads'];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];

    // 첫 번째 행은 헤더이므로 제외
    const headers = data[0];
    const rows = data.slice(1);

    // 검색어를 소문자로 변환 (대소문자 구분 없이 검색)
    const searchQuery = query.toLowerCase().trim();

    // 품목 검색 (품목명에 검색어가 포함된 경우)
    const results: InventoryItem[] = rows
      .filter(row => {
        const itemName = String(row[2] || '').toLowerCase(); // C열: 품목명
        return itemName.includes(searchQuery);
      })
      .map(row => ({
        item_no: String(row[1] || ''),           // B열: 품목번호
        item_name: String(row[2] || ''),         // C열: 품목명
        supply_price: Number(row[15]) || 0,      // P열 (index 15): 공급가
        available_stock: Number(row[11]) || 0,   // L열 (index 11): 가용재고
        bonded_warehouse: Number(row[21]) || 0,  // V열 (index 21): 보세창고
        sales_30days: Number(row[12]) || 0,      // M열 (index 12): 30일 출고
      }))
      .filter(item => item.item_no) // 품목번호가 있는 것만
      .sort((a, b) => b.supply_price - a.supply_price); // 공급가 높은 순으로 정렬

    return NextResponse.json({
      results,
      count: results.length,
      query: query
    });

  } catch (error) {
    console.error('Inventory search error:', error);
    return NextResponse.json(
      { error: '재고 검색 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
