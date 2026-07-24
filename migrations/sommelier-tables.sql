-- 백화점 소믈리에(취향 문답 추천) 고객·이력 테이블 (CDV)
-- 고객: 성함+핸드폰(정규화 숫자만, 유니크). 문답 세션·구매 기록은 향후 자동추천 학습 데이터.

create table if not exists sommelier_customers (
  id bigint generated always as identity primary key,
  name text not null,
  phone text not null unique, -- 숫자만 (01012345678)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sommelier_sessions (
  id bigint generated always as identity primary key,
  customer_id bigint not null references sommelier_customers(id) on delete cascade,
  manager text not null,           -- 문답을 진행한 직원
  answers jsonb not null,          -- 취향 문답 (QuizAnswers)
  results jsonb not null default '[]'::jsonb, -- 추천 결과 스냅샷 [{item_code, name, score...}]
  created_at timestamptz not null default now()
);
create index if not exists idx_sommelier_sessions_customer on sommelier_sessions(customer_id, created_at desc);

create table if not exists sommelier_orders (
  id bigint generated always as identity primary key,
  customer_id bigint not null references sommelier_customers(id) on delete cascade,
  session_id bigint references sommelier_sessions(id) on delete set null,
  item_code text not null,
  item_name text not null default '',
  retail_price numeric not null default 0,
  quantity int not null default 1,
  manager text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_sommelier_orders_customer on sommelier_orders(customer_id, created_at desc);
create index if not exists idx_sommelier_orders_item on sommelier_orders(item_code);
