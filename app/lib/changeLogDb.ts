// 변경이력 로깅 시스템 (Supabase)

import { supabase } from "@/app/lib/db";
import type { ChangeLogEntry } from "@/app/types/wine";

export async function logChange(action: string, entityType: string, entityId: string, details?: Record<string, unknown>) {
  await supabase.from('change_logs').insert({
    action,
    entity_type: entityType,
    entity_id: entityId,
    details: details ? JSON.stringify(details) : null,
  });
}

export async function getChangeLogs(
  page: number = 1,
  limit: number = 20,
  filters?: { action?: string; entityType?: string; entityId?: string }
): Promise<{ logs: ChangeLogEntry[]; total: number }> {
  let countQuery = supabase.from('change_logs').select('*', { count: 'exact', head: true });
  let dataQuery = supabase.from('change_logs').select('*');

  if (filters?.action) {
    countQuery = countQuery.eq('action', filters.action);
    dataQuery = dataQuery.eq('action', filters.action);
  }
  if (filters?.entityType) {
    countQuery = countQuery.eq('entity_type', filters.entityType);
    dataQuery = dataQuery.eq('entity_type', filters.entityType);
  }
  if (filters?.entityId) {
    countQuery = countQuery.eq('entity_id', filters.entityId);
    dataQuery = dataQuery.eq('entity_id', filters.entityId);
  }

  const { count: total } = await countQuery;
  const offset = (page - 1) * limit;
  const { data: logs } = await dataQuery
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  return { logs: (logs || []) as ChangeLogEntry[], total: total || 0 };
}

export async function getRecentChanges(limit: number = 10): Promise<ChangeLogEntry[]> {
  const { data } = await supabase
    .from('change_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data || []) as ChangeLogEntry[];
}
