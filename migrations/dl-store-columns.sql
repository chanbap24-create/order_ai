-- 대유라이프(DL) 재고표에 포함된 백화점 매장 재고 컬럼.
-- CDV의 강남점(HOS)과는 별도 매장. 소믈리에 추천이 CDV+DL 매장 재고를 합산해서 본다.
alter table inventory_dl
  add column if not exists store_ssg_gangnam_dl integer default 0,
  add column if not exists store_ssg_southcity integer default 0;
