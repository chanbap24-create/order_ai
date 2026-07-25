-- 2026-07 글라스(DL) 재고표 확장 — 본사·B급·반품·불량·특자판·위탁 창고 + GIG 영업2부
alter table inventory_dl
  add column if not exists hq_warehouse real default 0,          -- 본사창고(DL)
  add column if not exists gig_sales2 real default 0,            -- GIG(영업2부)
  add column if not exists b_grade_warehouse real default 0,     -- B급재고 창고
  add column if not exists gig_returns real default 0,           -- GIG(반품)
  add column if not exists defective real default 0,             -- 불량
  add column if not exists special_warehouse real default 0,     -- 특자판창고
  add column if not exists consignment_warehouse real default 0; -- 위탁창고
