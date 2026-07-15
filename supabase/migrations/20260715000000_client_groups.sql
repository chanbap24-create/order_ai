-- 거래처 그룹(즐겨찾기) — 영업사원이 견적 보낼 거래처를 임의 그룹으로 저장·관리.
-- clients = [{code, name}] jsonb: 기간 목록에 없는 거래처도 일괄 견적 대상에 포함 가능하게 이름 동봉.
create table if not exists client_groups (
  id bigint generated always as identity primary key,
  manager text not null,
  client_type text not null default 'wine',
  name text not null,
  clients jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_client_groups_mgr on client_groups (manager, client_type);
