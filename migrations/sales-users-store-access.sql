-- 매장 앱(소믈리에·재고 PWA) 접근 권한 — 백화점 직원(영업2부) + 소믈리에 관리자만.
-- role='store'(매장 전용 계정)는 이 플래그와 무관하게 매장 앱만 접근(영업 시스템 차단, middleware).
-- 적용: 2026-10-02 (Supabase MCP apply_migration)
alter table public.sales_users add column if not exists store_access boolean not null default false;
update public.sales_users set store_access = true
where is_active is not false and (department = '영업2부' or manager in ('조성재', '박경아'));
