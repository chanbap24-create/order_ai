import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { config } from "./config";
import { logger } from "./logger";

// ✅ 배포 시 보존할 테이블 목록 (학습 + 와인관리 데이터)
const LEARNING_TABLES = [
  'item_alias', 'client_alias', 'token_mapping', 'search_learning',
  'wines', 'tasting_notes', 'wine_images', 'change_logs', 'admin_settings', 'price_history',
];

/**
 * ✅ /tmp DB에서 학습 데이터를 백업한 뒤, 원본 DB 복사 후 학습 데이터를 복원
 * Vercel 콜드 스타트 시 학습 데이터 유실 방지
 */
function preserveLearningData(tmpPath: string, originalPath: string) {
  const backupPath = "/tmp/data_learning_backup.sqlite3";
  
  try {
    if (!fs.existsSync(tmpPath)) return;

    // 1) 기존 /tmp DB에서 학습 테이블 백업
    const oldDb = new Database(tmpPath, { readonly: true });
    const backupDb = new Database(backupPath);

    let hasLearningData = false;

    for (const table of LEARNING_TABLES) {
      try {
        const rows = oldDb.prepare(`SELECT * FROM ${table}`).all() as any[];
        if (!rows.length) continue;
        hasLearningData = true;

        // 스키마 복사
        const createSql = oldDb.prepare(
          `SELECT sql FROM sqlite_master WHERE type='table' AND name=?`
        ).get(table) as { sql: string } | undefined;
        if (createSql?.sql) {
          backupDb.prepare(`DROP TABLE IF EXISTS ${table}`).run();
          backupDb.prepare(createSql.sql).run();
          
          // 데이터 복사
          const cols = oldDb.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
          const colNames = cols.map(c => c.name);
          const placeholders = colNames.map(() => '?').join(',');
          const ins = backupDb.prepare(
            `INSERT OR REPLACE INTO ${table} (${colNames.join(',')}) VALUES (${placeholders})`
          );
          backupDb.transaction(() => {
            for (const row of rows) {
              ins.run(...colNames.map(c => (row as any)[c]));
            }
          })();
          logger.info(`[Learning Backup] ${table}: ${rows.length} rows backed up`);
        }
      } catch {
        // 테이블이 없으면 무시
      }
    }

    oldDb.close();
    backupDb.close();

    if (!hasLearningData) {
      try { fs.unlinkSync(backupPath); } catch {}
      return;
    }

    // 2) 원본 DB를 /tmp로 복사 (최신 상품/거래처 데이터)
    fs.copyFileSync(originalPath, tmpPath);
    logger.info("Database copied to /tmp (fresh)", { from: originalPath, to: tmpPath });

    // 3) 백업한 학습 데이터를 새 /tmp DB에 복원
    const newDb = new Database(tmpPath);
    const bkDb = new Database(backupPath, { readonly: true });

    for (const table of LEARNING_TABLES) {
      try {
        const rows = bkDb.prepare(`SELECT * FROM ${table}`).all() as any[];
        if (!rows.length) continue;

        // 새 DB에 테이블이 있는지 확인
        const exists = newDb.prepare(
          `SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name=?`
        ).get(table) as { cnt: number };

        if (!exists.cnt) {
          // 백업 스키마로 생성
          const createSql = bkDb.prepare(
            `SELECT sql FROM sqlite_master WHERE type='table' AND name=?`
          ).get(table) as { sql: string } | undefined;
          if (createSql?.sql) newDb.prepare(createSql.sql).run();
        }

        const cols = bkDb.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
        const newCols = newDb.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
        const newColNames = new Set(newCols.map(c => c.name));
        // 새 테이블에 존재하는 컬럼만 사용
        const commonCols = cols.map(c => c.name).filter(c => newColNames.has(c));
        if (!commonCols.length) continue;

        const placeholders = commonCols.map(() => '?').join(',');
        const ins = newDb.prepare(
          `INSERT OR REPLACE INTO ${table} (${commonCols.join(',')}) VALUES (${placeholders})`
        );
        newDb.transaction(() => {
          for (const row of rows) {
            ins.run(...commonCols.map(c => (row as any)[c]));
          }
        })();
        logger.info(`[Learning Restore] ${table}: ${rows.length} rows restored`);
      } catch (err) {
        logger.warn(`[Learning Restore] ${table} failed:`, { error: err });
      }
    }

    newDb.close();
    bkDb.close();

    // 백업 파일 삭제
    try { fs.unlinkSync(backupPath); } catch {}
  } catch (err) {
    logger.warn("[Learning Preserve] Failed (non-fatal):", { error: err });
    // 실패 시 원본 그대로 복사
    try {
      fs.copyFileSync(originalPath, tmpPath);
    } catch {}
  }
}

// Vercel 호환: 프로덕션에서는 /tmp에 DB 복사
function getDatabasePath(): string {
  const originalPath = config.database.path
    ? path.isAbsolute(config.database.path)
      ? config.database.path
      : path.join(process.cwd(), config.database.path)
    : path.join(process.cwd(), "data.sqlite3");

  // 프로덕션 환경 (Vercel)에서는 /tmp에 복사
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    const tmpPath = "/tmp/data.sqlite3";
    
    try {
      if (fs.existsSync(originalPath)) {
        if (fs.existsSync(tmpPath)) {
          // ✅ 이미 /tmp DB 존재: 학습 데이터가 있을 수 있으므로 그대로 사용
          // 단, 원본이 더 최신이면 학습 데이터 보존하며 갱신
          const origStat = fs.statSync(originalPath);
          const tmpStat = fs.statSync(tmpPath);
          if (origStat.mtimeMs > tmpStat.mtimeMs) {
            // 새 배포(원본이 더 최신): 학습 데이터 보존하며 원본 복사
            preserveLearningData(tmpPath, originalPath);
          }
          // 그 외: 기존 /tmp DB 유지 (학습 데이터 포함)
        } else {
          // /tmp DB 없음: 최초 복사
          fs.copyFileSync(originalPath, tmpPath);
          logger.info("Database copied to /tmp for write support", { 
            from: originalPath, 
            to: tmpPath 
          });
        }
      }
      return tmpPath;
    } catch (err) {
      logger.warn("Failed to copy database to /tmp, using original", { 
        error: err,
        path: originalPath 
      });
      return originalPath;
    }
  }

  return originalPath;
}

const dbPath = getDatabasePath();

logger.info("Database initialized", { path: dbPath });

export const db = new Database(dbPath, {
  verbose: process.env.NODE_ENV === "development" ? ((msg: unknown) => logger.debug(String(msg))) : undefined,
});

// WAL 모드 활성화 (성능 향상) - /tmp에서만
if (dbPath.startsWith("/tmp")) {
  try {
    db.pragma("journal_mode = WAL");
  } catch (err) {
    logger.warn("Failed to enable WAL mode", { error: err });
  }
} else {
  db.pragma("journal_mode = WAL");
}

// ✅ DB 스키마 자동 보정 (Vercel cold start 대응)
try {
  // token_mapping 테이블 스키마 확인/재생성
  const tmCols = db.prepare("PRAGMA table_info(token_mapping)").all() as Array<{ name: string }>;
  const tmColNames = tmCols.map(c => c.name);
  if (tmCols.length > 0 && !tmColNames.includes("token")) {
    // 잘못된 스키마 → 재생성
    db.prepare("DROP TABLE IF EXISTS token_mapping").run();
    logger.info("token_mapping table dropped (schema mismatch)");
  }
  if (tmCols.length === 0 || !tmColNames.includes("token")) {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS token_mapping (
        token TEXT NOT NULL,
        mapped_text TEXT NOT NULL,
        token_type TEXT DEFAULT 'item',
        confidence REAL DEFAULT 0.5,
        learned_count INTEGER DEFAULT 1,
        last_used TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (token, mapped_text)
      )
    `).run();
    logger.info("token_mapping table created with correct schema");
  }

  // client_alias 테이블 PK 확인/재생성
  const caCols = db.prepare("PRAGMA table_info(client_alias)").all() as Array<{ name: string; pk: number }>;
  const caPKs = caCols.filter(c => c.pk > 0).map(c => c.name);
  if (caCols.length > 0 && !(caPKs.includes("client_code") && caPKs.includes("alias"))) {
    // PK가 (client_code, alias)가 아님 → 재생성
    const existingData = db.prepare("SELECT * FROM client_alias").all() as any[];
    db.prepare("DROP TABLE client_alias").run();
    db.prepare(`
      CREATE TABLE client_alias (
        client_code TEXT NOT NULL,
        alias TEXT NOT NULL,
        weight INTEGER DEFAULT 1,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (client_code, alias)
      )
    `).run();
    db.prepare("CREATE INDEX IF NOT EXISTS idx_client_alias_code ON client_alias(client_code)").run();
    const ins = db.prepare("INSERT OR IGNORE INTO client_alias (client_code, alias, weight, updated_at) VALUES (?,?,?,?)");
    db.transaction(() => {
      for (const r of existingData) {
        ins.run(r.client_code, r.alias, r.weight || 1, r.updated_at || null);
      }
    })();
    logger.info("client_alias table recreated with correct PK", { rows: existingData.length });
  }
  // client_item_stats: supply_price 컬럼 확인/추가
  const cisCols = db.prepare("PRAGMA table_info(client_item_stats)").all() as Array<{ name: string }>;
  const cisColNames = cisCols.map(c => c.name);
  if (cisCols.length > 0 && !cisColNames.includes("supply_price")) {
    try {
      db.prepare("ALTER TABLE client_item_stats ADD COLUMN supply_price REAL").run();
      logger.info("client_item_stats: supply_price column added");
    } catch { /* already exists */ }
  }
} catch (err) {
  logger.warn("DB schema auto-fix failed (non-fatal)", { error: err });
}
