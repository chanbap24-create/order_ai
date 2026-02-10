import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import { db } from '@/app/lib/db';
import { getUploadedFilePath, getAllUploadTimestamps } from '@/app/lib/adminUpload';

export const runtime = 'nodejs';

/**
 * 시트 데이터를 가져옴: /tmp에 업로드된 파일이 있으면 우선 사용, 없으면 번들 xlsx에서 읽기
 */
function getSheetData(uploadType: string, sheetName: string, bundledWorkbook: XLSX.WorkBook | null): any[] | null {
  // 1) /tmp에 업로드된 파일 우선
  const uploadedPath = getUploadedFilePath(uploadType);
  if (uploadedPath) {
    try {
      const buf = fs.readFileSync(uploadedPath);
      const wb = XLSX.read(buf, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (ws) {
        console.log(`  Using uploaded file: ${uploadedPath}`);
        return XLSX.utils.sheet_to_json(ws, { header: 1 });
      }
    } catch (e) {
      console.warn(`  Failed to read uploaded file ${uploadedPath}, falling back to bundled`);
    }
  }

  // 2) 번들 xlsx 폴백
  if (bundledWorkbook && bundledWorkbook.SheetNames.includes(sheetName)) {
    const ws = bundledWorkbook.Sheets[sheetName];
    console.log(`  Using bundled sheet: ${sheetName}`);
    return XLSX.utils.sheet_to_json(ws, { header: 1 });
  }

  return null;
}

/**
 * Excel 파일에서 재고 데이터를 읽어 DB에 동기화
 * POST /api/sync-inventory
 */
export async function POST() {
  try {
    console.log('Starting inventory sync...');

    // 번들 Excel 파일 (폴백용)
    const filePath = path.join(process.cwd(), 'order-ai.xlsx');
    let bundledWorkbook: XLSX.WorkBook | null = null;

    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      bundledWorkbook = XLSX.read(buffer, { type: 'buffer' });
    }

    // ===== CDV (Downloads) 동기화 =====
    console.log('Syncing CDV (Downloads) inventory...');

    const downloadsData = getSheetData('downloads', 'Downloads', bundledWorkbook);

    if (!downloadsData) {
      return NextResponse.json(
        { error: 'Downloads 데이터를 찾을 수 없습니다. (업로드 파일 또는 번들 xlsx 없음)' },
        { status: 404 }
      );
    }
    
    // Clear existing data
    db.prepare('DELETE FROM inventory_cdv').run();
    
    // Insert CDV data
    const insertCDV = db.prepare(`
      INSERT OR REPLACE INTO inventory_cdv (
        item_no, item_name, supply_price, discount_price, wholesale_price, 
        retail_price, min_price, available_stock, bonded_warehouse, 
        incoming_stock, sales_30days, vintage, alcohol_content, country
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        Number(row[12]) || 0,          // M: 30일출고
        String(row[6] || ''),          // G: 빈티지
        String(row[7] || ''),          // H: 알콜도수
        String(row[8] || '')           // I: 국가
      );
      cdvCount++;
    }
    
    console.log(`✅ CDV: ${cdvCount} items synced`);
    
    // ===== DL (Glass) 동기화 =====
    console.log('Syncing DL (Glass) inventory...');

    const dlData = getSheetData('dl', 'DL', bundledWorkbook);

    if (!dlData) {
      return NextResponse.json(
        { error: 'DL 데이터를 찾을 수 없습니다. (업로드 파일 또는 번들 xlsx 없음)' },
        { status: 404 }
      );
    }
    
    // Clear existing data
    db.prepare('DELETE FROM inventory_dl').run();
    
    // Insert DL data
    const insertDL = db.prepare(`
      INSERT OR REPLACE INTO inventory_dl (
        item_no, item_name, supply_price, available_stock, anseong_warehouse, 
        sales_30days, vintage, alcohol_content, country
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        Number(row[12]) || 0,          // M: 30일출고
        String(row[6] || ''),          // G: 빈티지
        String(row[7] || ''),          // H: 알콜도수
        String(row[8] || '')           // I: 국가
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
    
    const uploadTimestamps = getAllUploadTimestamps();

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
      },
      uploadTimestamps
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
