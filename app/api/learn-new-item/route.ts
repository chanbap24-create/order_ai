/**
 * POST /api/learn-new-item
 * 
 * 신규 품목 학습: English 시트에서 찾은 품목을 거래처별로 저장
 * 
 * Body:
 * {
 *   clientCode: string;     // 거래처 코드 (예: "10001")
 *   inputName: string;      // 사용자가 입력한 품목명 (예: "샤또마르고")
 *   selectedItemNo: string; // 선택한 품목 코드 (예: "1H19001")
 *   selectedName: string;   // 선택한 품목명 (예: "Chateau Margaux")
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';

export const runtime = 'nodejs';

/**
 * client_new_items 테이블 생성
 */
function ensureClientNewItemsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS client_new_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_code TEXT NOT NULL,
      input_name TEXT NOT NULL,
      item_no TEXT NOT NULL,
      item_name TEXT NOT NULL,
      learned_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(client_code, input_name, item_no)
    )
  `);

  // 인덱스 생성 (빠른 검색)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_client_new_items_lookup 
    ON client_new_items(client_code, input_name)
  `);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientCode, inputName, selectedItemNo, selectedName } = body;

    // 필수 필드 검증
    if (!clientCode || !inputName || !selectedItemNo || !selectedName) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: clientCode, inputName, selectedItemNo, selectedName' 
        },
        { status: 400 }
      );
    }

    // 테이블 생성
    ensureClientNewItemsTable();

    // 데이터 저장 (중복 시 업데이트)
    const stmt = db.prepare(`
      INSERT INTO client_new_items (client_code, input_name, item_no, item_name, learned_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(client_code, input_name, item_no) 
      DO UPDATE SET 
        item_name = excluded.item_name,
        learned_at = CURRENT_TIMESTAMP
    `);

    const result = stmt.run(clientCode, inputName, selectedItemNo, selectedName);

    // 저장된 데이터 조회
    const saved = db.prepare(`
      SELECT * FROM client_new_items 
      WHERE client_code = ? AND input_name = ? AND item_no = ?
    `).get(clientCode, inputName, selectedItemNo);

    return NextResponse.json({
      success: true,
      saved: result.changes,
      data: saved,
    });

  } catch (error: any) {
    console.error('[learn-new-item] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
