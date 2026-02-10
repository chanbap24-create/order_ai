// 변경이력 로깅 시스템

import { db } from "@/app/lib/db";
import { ensureWineTables } from "@/app/lib/wineDb";
import type { ChangeLogEntry } from "@/app/types/wine";

export function logChange(action: string, entityType: string, entityId: string, details?: Record<string, unknown>) {
  ensureWineTables();
  db.prepare(`
    INSERT INTO change_logs (action, entity_type, entity_id, details)
    VALUES (?, ?, ?, ?)
  `).run(action, entityType, entityId, details ? JSON.stringify(details) : null);
}

export function getChangeLogs(
  page: number = 1,
  limit: number = 20,
  filters?: { action?: string; entityType?: string; entityId?: string }
): { logs: ChangeLogEntry[]; total: number } {
  ensureWineTables();

  let countSql = 'SELECT COUNT(*) as cnt FROM change_logs WHERE 1=1';
  let sql = 'SELECT * FROM change_logs WHERE 1=1';
  const params: unknown[] = [];

  if (filters?.action) {
    const clause = ' AND action = ?';
    countSql += clause;
    sql += clause;
    params.push(filters.action);
  }
  if (filters?.entityType) {
    const clause = ' AND entity_type = ?';
    countSql += clause;
    sql += clause;
    params.push(filters.entityType);
  }
  if (filters?.entityId) {
    const clause = ' AND entity_id = ?';
    countSql += clause;
    sql += clause;
    params.push(filters.entityId);
  }

  const total = (db.prepare(countSql).get(...params) as { cnt: number }).cnt;

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  const offset = (page - 1) * limit;
  const logs = db.prepare(sql).all(...params, limit, offset) as ChangeLogEntry[];

  return { logs, total };
}

export function getRecentChanges(limit: number = 10): ChangeLogEntry[] {
  ensureWineTables();
  return db.prepare('SELECT * FROM change_logs ORDER BY created_at DESC LIMIT ?').all(limit) as ChangeLogEntry[];
}
