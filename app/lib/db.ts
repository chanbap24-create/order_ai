import Database from "better-sqlite3";
import path from "path";
import { config } from "./config";
import { logger } from "./logger";

const dbPath = config.database.path
  ? path.isAbsolute(config.database.path)
    ? config.database.path
    : path.join(process.cwd(), config.database.path)
  : path.join(process.cwd(), "data.sqlite3");

logger.info("Database initialized", { path: dbPath });

export const db = new Database(dbPath, {
  verbose: process.env.NODE_ENV === "development" ? ((msg: unknown) => logger.debug(String(msg))) : undefined,
});

// WAL 모드 활성화 (성능 향상)
db.pragma("journal_mode = WAL");
