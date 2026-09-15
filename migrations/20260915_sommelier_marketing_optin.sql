-- 마케팅(광고성 정보) 수신 동의 — 필수 동의와 분리된 선택 동의 (개보법 22조, 망법 50조 대비)
alter table sommelier_customers
  add column if not exists marketing_opt_in boolean not null default false,
  add column if not exists marketing_opt_in_at timestamptz;
