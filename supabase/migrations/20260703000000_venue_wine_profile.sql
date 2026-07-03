-- 업장 유형별 와인 선호 '등급 점수' 자동 학습 결과 저장. 주기 갱신(수동/cron).
-- 타입=절대 비중, 국가/지역=lift(전체 대비) + 표본 shrinkage. 지역 key는 산지계층 문자열 그대로.
-- 스코어러는 이 테이블을 읽고, 없으면 하드코딩 VENUE_WINE_MAP 으로 폴백.
create table if not exists venue_wine_profile (
  venue text not null,        -- venueTypes VENUE_MAP 의 key (sushi/italian/...)
  axis text not null,         -- 'type' | 'country' | 'region'
  key text not null,          -- 값: 'sparkling' / '프랑스' / 'Burgundy' 등
  points numeric not null,    -- 등급 점수(타입 ≤8 · 국가 ≤8 · 지역 ≤4)
  updated_at timestamptz not null default now(),
  primary key (venue, axis, key)
);
