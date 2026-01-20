import { NextResponse } from "next/server";
import { jsonResponse } from "@/app/lib/api-response";
import { db } from "@/app/lib/db";
import { learnFromSelection } from "@/app/lib/autoLearn";

export const runtime = "nodejs";

/**
 * ✅ 규칙 학습용 alias 정규화
 * - 너무 공격적이면 안 됨 (search_key랑 다름!)
 * - resolveItems.ts의 exact/contains 기준과 동일해야 함
 */
function normalizeAlias(raw: string) {
  return String(raw || "")
    .toLowerCase()
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .replace(/[()\-_/.,]/g, " ")
    .trim();
}

function ensureItemAliasTable() {
  // ✅ 1. 새 테이블 스키마 체크
  const tableInfo = db.prepare(`
    SELECT COUNT(*) as cnt 
    FROM pragma_table_info('item_alias') 
    WHERE name='alias' AND pk > 0
  `).get() as { cnt: number };

  // 테이블이 없거나 alias가 단독 PRIMARY KEY인 경우 마이그레이션 필요
  const needsMigration = tableInfo.cnt === 1;

  if (needsMigration) {
    console.log('[item_alias] 🔄 거래처별 학습을 위한 스키마 마이그레이션 시작...');
    
    try {
      // ✅ 기존 백업 테이블이 있으면 먼저 삭제
      try {
        db.prepare('DROP TABLE IF EXISTS item_alias_old').run();
        console.log('[item_alias] 🗑️  기존 백업 테이블 삭제됨');
      } catch {
        // 백업 테이블이 없으면 무시
      }

      // 기존 데이터 백업
      const oldData = db.prepare('SELECT * FROM item_alias').all();
      console.log(`[item_alias] 📦 백업: ${oldData.length}개 항목`);

      // 기존 테이블 이름 변경
      db.prepare('ALTER TABLE item_alias RENAME TO item_alias_old').run();

      // 새 테이블 생성 (복합 PRIMARY KEY)
      db.prepare(`
        CREATE TABLE item_alias (
          alias TEXT NOT NULL,
          canonical TEXT NOT NULL,
          client_code TEXT NOT NULL DEFAULT '*',
          count INTEGER DEFAULT 1,
          last_used_at TEXT DEFAULT CURRENT_TIMESTAMP,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (alias, client_code)
        )
      `).run();

      // 데이터 마이그레이션
      const insert = db.prepare(`
        INSERT OR REPLACE INTO item_alias (alias, canonical, client_code, count, last_used_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const row of oldData as any[]) {
        const clientCode = row.client_code || '*';
        insert.run(row.alias, row.canonical, clientCode, row.count || 1, row.last_used_at, row.created_at);
      }

      // 인덱스 추가
      db.prepare('CREATE INDEX IF NOT EXISTS idx_item_alias_canonical ON item_alias(canonical, client_code)').run();

      // 백업 테이블 삭제
      db.prepare('DROP TABLE item_alias_old').run();

      console.log(`[item_alias] ✅ 마이그레이션 완료: ${oldData.length}개 항목`);
    } catch (error) {
      console.error('[item_alias] ❌ 마이그레이션 실패:', error);
      throw error;
    }
  } else {
    // 테이블이 이미 존재하면 추가 컬럼만 확인
    try {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS item_alias (
          alias TEXT NOT NULL,
          canonical TEXT NOT NULL,
          client_code TEXT NOT NULL DEFAULT '*',
          count INTEGER DEFAULT 1,
          last_used_at TEXT DEFAULT CURRENT_TIMESTAMP,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (alias, client_code)
        )
      `).run();
    } catch {
      // 테이블이 이미 존재하면 무시
    }

    // 기존 컬럼 추가 (필요 시)
    try {
      db.prepare(`ALTER TABLE item_alias ADD COLUMN count INTEGER DEFAULT 1`).run();
    } catch {
      // 컬럼이 이미 존재하면 무시
    }

    try {
      db.prepare(`ALTER TABLE item_alias ADD COLUMN last_used_at TEXT DEFAULT CURRENT_TIMESTAMP`).run();
    } catch {
      // 컬럼이 이미 존재하면 무시
    }

    try {
      db.prepare(`ALTER TABLE item_alias ADD COLUMN client_code TEXT DEFAULT '*'`).run();
    } catch {
      // 컬럼이 이미 존재하면 무시
    }

    // 인덱스 추가
    try {
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_item_alias_canonical ON item_alias(canonical, client_code)`).run();
    } catch {
      // 인덱스가 이미 존재하면 무시
    }
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const rawAlias = String(body?.alias ?? "").trim();
    const canonical = String(body?.canonical ?? "").trim();
    const clientCode = String(body?.client_code ?? "*").trim(); // ✅ 거래처 코드 (기본값: '*' = 전역)

    if (!rawAlias || !canonical) {
      return jsonResponse(
        { success: false, error: "alias/canonical required" },
        { status: 400 }
      );
    }

    // ✅ 규칙 학습용 alias 정규화
    const alias = normalizeAlias(rawAlias);

    if (!alias) {
      return jsonResponse(
        { success: false, error: "alias empty after normalize" },
        { status: 400 }
      );
    }

    ensureItemAliasTable();

    // ✅ 거래처별 학습 with 누적 카운트
    // - alias가 PRIMARY KEY이므로 client_code를 WHERE 조건에서만 사용
    // - 같은 (alias, client_code)에 같은 canonical을 선택하면 count++
    // - 다른 canonical을 선택하면 count=1로 초기화 (새로운 학습)
    
    // client_code 컬럼이 있는지 확인
    const hasClientCode = db.prepare(`
      SELECT COUNT(*) as cnt FROM pragma_table_info('item_alias') WHERE name='client_code'
    `).get() as { cnt: number };

    if (hasClientCode.cnt > 0) {
      // client_code 컬럼이 있으면 거래처별 학습
      const existing = db.prepare(
        `SELECT canonical, count, client_code FROM item_alias WHERE alias = ? AND client_code = ?`
      ).get(alias, clientCode) as { canonical: string; count: number; client_code: string } | undefined;

      if (existing && existing.canonical === canonical) {
        // 같은 매핑: count 증가
        db.prepare(`
          UPDATE item_alias
          SET count = count + 1, last_used_at = CURRENT_TIMESTAMP
          WHERE alias = ? AND client_code = ?
        `).run(alias, clientCode);
      } else {
        // 새로운 매핑: 삭제 후 삽입 (alias가 PRIMARY KEY라 UPSERT 불가)
        db.prepare(`DELETE FROM item_alias WHERE alias = ? AND client_code = ?`).run(alias, clientCode);
        db.prepare(`
          INSERT INTO item_alias (alias, canonical, client_code, count, last_used_at, created_at)
          VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(alias, canonical, clientCode);
      }
    } else {
      // client_code 컬럼이 없으면 기존 방식 (전역 학습만)
      const existing = db.prepare(
        `SELECT canonical, count FROM item_alias WHERE alias = ?`
      ).get(alias) as { canonical: string; count: number } | undefined;

      if (existing && existing.canonical === canonical) {
        // 같은 매핑: count 증가
        db.prepare(`
          UPDATE item_alias
          SET count = count + 1, last_used_at = CURRENT_TIMESTAMP
          WHERE alias = ?
        `).run(alias);
      } else {
        // 새로운 매핑 또는 다른 매핑: 덮어쓰기
        db.prepare(`
          INSERT INTO item_alias (alias, canonical, count, last_used_at, created_at)
          VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(alias) DO UPDATE SET
            canonical = excluded.canonical,
            count = 1,
            last_used_at = CURRENT_TIMESTAMP
        `).run(alias, canonical);
      }
    }

    // ✅ 프론트 안정용: 실제 저장된 값 반환
    const row = hasClientCode.cnt > 0 
      ? db.prepare(
          `SELECT alias, canonical, client_code, count, last_used_at, created_at FROM item_alias WHERE alias = ? AND client_code = ?`
        ).get(alias, clientCode)
      : db.prepare(
          `SELECT alias, canonical, count, last_used_at, created_at FROM item_alias WHERE alias = ?`
        ).get(alias);

    // 🎓 자동 학습 시스템 연동: 토큰 매핑도 자동으로 학습
    try {
      // canonical이 품목번호인 경우 품목명 조회
      let itemName = canonical;
      let itemNo = canonical;
      
      // canonical이 숫자면 품목번호로 간주하고 품목명 조회
      if (/^\d+$/.test(canonical) || /^[A-Z0-9]+$/.test(canonical)) {
        // items 테이블에서 조회 시도
        const tables = ['items', 'item_master', 'Downloads_items'];
        for (const table of tables) {
          try {
            const item = db.prepare(`
              SELECT item_no, item_name FROM ${table} WHERE item_no = ?
              LIMIT 1
            `).get(canonical) as { item_no: string; item_name: string } | undefined;
            
            if (item) {
              itemNo = item.item_no;
              itemName = item.item_name;
              break;
            }
          } catch {
            continue;
          }
        }
      }
      
      // 자동 학습 실행 (토큰 매핑 + ML 데이터)
      const learnResult = learnFromSelection({
        query: rawAlias,
        selectedItem: {
          item_no: itemNo,
          item_name: itemName
        },
        rejectedItems: [],
        clientCode: body?.client_code || 'manual_learning',
        features: {
          manual_input: true,
          source: 'learn_item_alias_api'
        } as any
      });
      
      console.log(`[learn-item-alias] ✅ 자동 학습 완료:`, learnResult);
      
      return jsonResponse({
        success: true,
        saved: 1,
        row,
        autoLearn: {
          enabled: true,
          mappings: learnResult.mappings,
          mlDataId: learnResult.mlDataId,
          message: `토큰 매핑 ${learnResult.mappings.length}개 학습됨`
        }
      });
    } catch (autoLearnError) {
      console.error('[learn-item-alias] ⚠️ 자동 학습 실패 (계속 진행):', autoLearnError);
      
      // 자동 학습 실패해도 item_alias는 저장되었으므로 성공 반환
      return jsonResponse({
        success: true,
        saved: 1,
        row,
        autoLearn: {
          enabled: false,
          error: String(autoLearnError)
        }
      });
    }
  } catch (e: any) {
    return jsonResponse(
      { success: false, error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
