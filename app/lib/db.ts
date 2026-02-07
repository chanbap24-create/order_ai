import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { config } from "./config";
import { logger } from "./logger";

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
      // 원본 DB가 존재하면 /tmp로 복사 (쓰기 가능)
      if (fs.existsSync(originalPath) && !fs.existsSync(tmpPath)) {
        fs.copyFileSync(originalPath, tmpPath);
        logger.info("Database copied to /tmp for write support", { 
          from: originalPath, 
          to: tmpPath 
        });
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
