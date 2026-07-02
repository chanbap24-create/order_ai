-- 시음주 즐겨찾기(담당자별): 여러 와인 등록 + 선택적 기본값 1개.
-- 기본값 지정 시 시음주 선정에서 우선 사용, 없으면 AI 추천. (기존 '이달의 시음주 1픽' 대체)
create table if not exists public.tasting_favorites (
  company    text        not null,           -- CDV(와인) | DL(글라스)
  manager    text        not null,
  item_no    text        not null,
  item_name  text,
  is_default boolean     not null default false,
  created_at timestamptz not null default now(),
  primary key (company, manager, item_no)
);
-- 담당자별 기본값은 최대 1개(부분 유니크).
create unique index if not exists tasting_favorites_one_default
  on public.tasting_favorites (company, manager) where is_default;
