-- 매장 직원 → 소믈리에 관리자 수정 요청 (테이스팅 노트·이미지·판매가/재고·기타)
-- 적용: 2026-10-02 (Supabase MCP apply_migration)
create table if not exists public.sommelier_change_requests (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  item_no text not null,
  item_name_kr text,
  item_name_en text,
  category text not null check (category in ('note', 'image', 'price_stock', 'other')),
  message text,
  store_key text,
  requester text not null,
  status text not null default 'open' check (status in ('open', 'done')),
  resolved_at timestamptz,
  resolved_by text
);
create index if not exists sommelier_change_requests_status_idx
  on public.sommelier_change_requests (status, created_at desc);
alter table public.sommelier_change_requests enable row level security;
