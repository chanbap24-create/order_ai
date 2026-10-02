-- 매장 앱 계정별 고정 매장 — role='store'(백화점 매장 직원) 계정은 store_key 매장으로 로그인 고정,
-- 다른 매장 재고는 서버가 응답에서 제거. 본사(store_access=true, role≠store) 계정은 null = 전체 매장(판매 불가).
-- 적용: 2026-10-02 (Supabase MCP apply_migration)
alter table public.sales_users add column if not exists store_key text;
comment on column public.sales_users.store_key is '매장 전용 계정(role=store)의 고정 매장. 본사(store_access) 계정은 null = 전체 매장';
