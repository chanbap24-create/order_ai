-- 하위거래처 보정(매출등급 1단계업) 분기 1회 락.
-- 보정이 적용된 견적을 실제로 담기/발행한 순간 (거래처, 분기)를 기록하고,
-- 같은 분기엔 추천 생성 시 보정을 적용하지 않는다 (남발 방지).
create table if not exists discount_stepup_usage (
  client_code text not null,
  quarter text not null,              -- 'YYYY-Qn' (KST)
  manager text,
  created_at timestamptz default now(),
  primary key (client_code, quarter)
);
