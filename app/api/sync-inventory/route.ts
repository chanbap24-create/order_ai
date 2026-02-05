import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import { db } from '@/app/lib/db';

export const runtime = 'nodejs';

/**
 * Excel 파일에서 재고 데이터를 읽어 DB에 동기화
 * POST /api/sync-inventory
 */
export async function POST() {
  try {
    console.log('🔄 Starting inventory sync...');
    
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
    
    // ===== CDV (Downloads) 동기화 =====
    console.log('📦 Syncing CDV (Downloads) inventory...');
    
    if (!workbook.SheetNames.includes('Downloads')) {
      return NextResponse.json(
        { error: 'Downloads 시트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    const downloadsSheet = workbook.Sheets['Downloads'];
    const downloadsData: any[] = XLSX.utils.sheet_to_json(downloadsSheet, { header: 1 });
    
    // Clear existing data
    db.prepare('DELETE FROM inventory_cdv').run();
    
    // Insert CDV data
    const insertCDV = db.prepare(`
      INSERT OR REPLACE INTO inventory_cdv (
        item_no, item_name, supply_price, discount_price, wholesale_price, 
        retail_price, min_price, available_stock, bonded_warehouse, 
        incoming_stock, sales_30days
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    let cdvCount = 0;
    for (let i = 1; i < downloadsData.length; i++) {
      const row = downloadsData[i];
      const itemNo = String(row[1] || '').trim();
      if (!itemNo) continue;
      
      insertCDV.run(
        itemNo,
        String(row[2] || ''),         // C: 품명
        Number(row[15]) || 0,          // P: 공급가
        Number(row[16]) || 0,          // Q: 할인공급가
        Number(row[17]) || 0,          // R: 도매가
        Number(row[18]) || 0,          // S: 판매가
        Number(row[19]) || 0,          // T: 최저판매가
        Number(row[11]) || 0,          // L: 가용재고
        Number(row[21]) || 0,          // V: 보세창고
        Number(row[20]) || 0,          // U: 미착품
        Number(row[12]) || 0           // M: 30일출고
      );
      cdvCount++;
    }
    
    console.log(`✅ CDV: ${cdvCount} items synced`);
    
    // ===== DL (Glass) 동기화 =====
    console.log('📦 Syncing DL (Glass) inventory...');
    
    if (!workbook.SheetNames.includes('DL')) {
      return NextResponse.json(
        { error: 'DL 시트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    const dlSheet = workbook.Sheets['DL'];
    const dlData: any[] = XLSX.utils.sheet_to_json(dlSheet, { header: 1 });
    
    // Clear existing data
    db.prepare('DELETE FROM inventory_dl').run();
    
    // Insert DL data
    const insertDL = db.prepare(`
      INSERT OR REPLACE INTO inventory_dl (item_no, item_name, supply_price, available_stock, anseong_warehouse, sales_30days)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    let dlCount = 0;
    for (let i = 1; i < dlData.length; i++) {
      const row = dlData[i];
      const itemNo = String(row[1] || '').trim();
      if (!itemNo) continue;
      
      insertDL.run(
        itemNo,
        String(row[2] || ''),         // C: 품명
        Number(row[15]) || 0,          // P: 공급가
        Number(row[11]) || 0,          // L: 재고
        Number(row[23]) || 0,          // X: 안성창고
        Number(row[12]) || 0           // M: 30일출고
      );
      dlCount++;
    }
    
    console.log(`✅ DL: ${dlCount} items synced`);
    
    return NextResponse.json({
      success: true,
      message: '재고 데이터 동기화 완료',
      stats: {
        cdv_items: cdvCount,
        dl_items: dlCount,
        total: cdvCount + dlCount
      }
    });
    
  } catch (error: any) {
    console.error('❌ Sync error:', error);
    return NextResponse.json(
      { 
        error: '동기화 중 오류가 발생했습니다.',
        details: error.message,
        stack: error.stack
      },
      { status: 500 }
    );
  }
}

/**
 * 현재 DB 상태 확인
 * GET /api/sync-inventory
 */
export async function GET() {
  try {
    const cdvCount = db.prepare('SELECT COUNT(*) as count FROM inventory_cdv').get() as { count: number };
    const dlCount = db.prepare('SELECT COUNT(*) as count FROM inventory_dl').get() as { count: number };
    
    const cdvSample = db.prepare('SELECT * FROM inventory_cdv LIMIT 3').all();
    const dlSample = db.prepare('SELECT * FROM inventory_dl LIMIT 3').all();
    
    return NextResponse.json({
      success: true,
      stats: {
        cdv_items: cdvCount.count,
        dl_items: dlCount.count,
        total: cdvCount.count + dlCount.count
      },
      samples: {
        cdv: cdvSample,
        dl: dlSample
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
