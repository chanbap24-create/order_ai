-- 단골 카드 직원 메모 — 손님 응대 팁(선호·주의사항). 손님 파기 시 행과 함께 삭제됨.
-- 적용: 2026-10-03 (Supabase MCP apply_migration)
alter table public.sommelier_customers
  add column if not exists memo text,
  add column if not exists memo_updated_at timestamptz,
  add column if not exists memo_updated_by text;
