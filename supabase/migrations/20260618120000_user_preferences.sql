-- 계정(매니저)별 설정 저장 (key-value). /api/user/preferences 가 사용.
-- 예: 추천견적 컬럼 구성(recommend_quote_columns)을 계정별로 유지.
create table if not exists user_preferences (
  manager text not null,
  key text not null,
  value jsonb,
  updated_at timestamptz default now(),
  primary key (manager, key)
);
