-- 매장 앱 입고 알림 — 입고 예정 와인에 손님 이름으로 알림 신청 → 본사 가용재고가 늘면 신청한 사원에게 알림
-- 손님 파기(보유기간 만료) 시 함께 삭제(on delete cascade). 법인은 매장 기준(corp).
-- 적용: 2026-10-02 (Supabase MCP apply_migration)
create table if not exists public.store_restock_alerts (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  corp text not null check (corp in ('cdv', 'dl')),
  store_key text not null,
  item_no text not null,
  item_name text not null default '',
  customer_id bigint not null references public.sommelier_customers(id) on delete cascade,
  staff text not null,                      -- 신청한 사원(sales_users.manager) = 알림 받을 사람
  baseline_hq integer not null default 0,   -- 신청 시점 본사 가용재고 — 이보다 늘면 '입고'
  status text not null default 'waiting' check (status in ('waiting', 'arrived', 'done')),
  arrived_at timestamptz,
  notified_at timestamptz,                  -- 텔레그램 발송 시각
  done_at timestamptz
);
-- 같은 손님·같은 와인은 대기 중 1건만
create unique index if not exists store_restock_alerts_waiting_uniq
  on public.store_restock_alerts (customer_id, item_no) where status = 'waiting';
create index if not exists store_restock_alerts_staff_idx
  on public.store_restock_alerts (staff, status, created_at desc);
alter table public.store_restock_alerts enable row level security;
