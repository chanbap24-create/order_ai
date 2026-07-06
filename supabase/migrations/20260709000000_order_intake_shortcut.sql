-- 단축어(iOS Shortcuts)로 들어온 발주 스크린샷 수신함 + 담당자별 토큰.
create table if not exists order_intake (
  id bigserial primary key,
  manager text not null,
  tab text not null default 'CDV',
  client_hint text,
  order_text text,
  result jsonb,
  status text not null default 'pending',   -- pending | done | dismissed | failed
  created_at timestamptz not null default now()
);
create index if not exists idx_order_intake_mgr_status on order_intake(manager, status, created_at desc);

create table if not exists shortcut_tokens (
  token text primary key,
  manager text not null unique,
  created_at timestamptz not null default now()
);
