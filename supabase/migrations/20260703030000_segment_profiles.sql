-- 업장유형·지역별 구매 프로파일(신규 거래처 추천용). 이력 없으면 이 데이터로 추천, 쌓이면 개인화로 전환.
-- 일일 cron(/api/cron/segment-profiles) + 어드민 '업장추천' 탭 갱신 버튼으로 재계산.
create table if not exists segment_profiles (
  segment_type text not null,       -- 'venue'(업장유형) | 'region'(지역 시/구)
  segment_key text not null,        -- 'sushi' | '서울 강남구'
  label text,
  client_count int default 0,
  bottle_count int default 0,
  price_median int default 0,       -- 주력가(병수 가중 중앙값, 0원 제외)
  price_p25 int default 0,
  price_p75 int default 0,
  type_dist jsonb default '{}'::jsonb,      -- {스파클링:0.3, 화이트:0.4, ...}
  top_countries jsonb default '[]'::jsonb,  -- [{country, share}]
  top_items jsonb default '[]'::jsonb,      -- [{item_no, name, breadth, qty}]
  updated_at timestamptz default now(),
  primary key (segment_type, segment_key)
);
comment on table segment_profiles is '업장유형·지역별 구매 프로파일(신규 거래처 추천용).';
