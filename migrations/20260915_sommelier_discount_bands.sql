-- 소믈리에 백화점 할인 밴드 (가격대별 할인율)
-- 정상 판매가는 실판매가가 아니므로, 권한자(박경아·조성재)가 가격대별 할인율을 조정해
-- 소믈리에 카드에 정상가→할인가로 노출한다. rate=0 이면 할인 없음(정상가 그대로).
create table if not exists sommelier_discount_bands (
  id serial primary key,
  min_price int not null,          -- 판매가 기준, 이상
  max_price int,                   -- 미만 경계 (null = 무제한)
  rate numeric not null default 0 check (rate >= 0 and rate <= 70), -- 할인율 %
  updated_by text,
  updated_at timestamptz not null default now()
);

insert into sommelier_discount_bands (min_price, max_price, rate)
select v.min_price, v.max_price, 0
from (values
  (0, 30000), (30000, 50000), (50000, 100000),
  (100000, 300000), (300000, 1000000), (1000000, null)
) as v(min_price, max_price)
where not exists (select 1 from sommelier_discount_bands);
