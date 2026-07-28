-- 백화점 매장 재고 스냅샷 — 매장 컬럼이 있는 확장 재고표 업로드 시에만 교체.
-- 일일 영업 재고표(inventory_cdv)와 분리해 서로 덮어쓰지 않게 한다. 소믈리에 추천 풀의 원천.
create table if not exists dept_store_stock (
  item_no text primary key,
  item_name text not null default '',
  importer text not null default '',
  retail_price real not null default 0,
  supply_price real not null default 0,
  store_hyundai_main real not null default 0,
  store_hyundai_jungdong real not null default 0,
  store_hyundai_trade real not null default 0,
  store_ssg_gangnam real not null default 0,
  store_thehyundai real not null default 0,
  updated_at timestamptz not null default now()
);
