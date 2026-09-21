-- 행사 POS 기기별 상태 스냅샷 (오프라인 우선 → 온라인 시 업서트). 판매·재고·시음 기록 전체를 JSON으로 보관.
-- 적용: 2026-09-18 (Supabase MCP apply_migration)
create table if not exists public.expo_pos_snapshots (
  device_id   text primary key,
  device_name text not null default '',
  event_name  text not null default '',
  state       jsonb not null,
  sales_count int  not null default 0,
  updated_at  timestamptz not null default now()
);
alter table public.expo_pos_snapshots enable row level security;
-- 서비스 롤(API 라우트)만 접근. anon/authenticated 정책 없음 = 차단.
comment on table public.expo_pos_snapshots is '행사 와인판매 임시 POS(/expo-pos) 기기별 상태 백업';
