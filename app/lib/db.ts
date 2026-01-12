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
