-- 손님 연령대·성별(직원이 대략 기록) — 추후 연령·성별·지역(매장)별 추천용. 단골 카드(직원용)에서만 보임.
-- consent_version: 1 = 성함·연락처만 고지한 옛 동의, 2 = 구매·취향 기록 + 연령대·성별(직원 기록) 항목까지 고지한 동의.
-- 연령대·성별은 동의 2 이상인 손님만 저장(개인정보보호법 §15 — 고지한 항목만 수집).
alter table sommelier_customers
  add column if not exists age_band text check (age_band in ('20s', '30s', '40s', '50s', '60s')),
  add column if not exists gender text check (gender in ('F', 'M')),
  add column if not exists profile_updated_at timestamptz,
  add column if not exists profile_updated_by text,
  add column if not exists consent_version smallint not null default 1;
