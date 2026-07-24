-- 2026-07 재고표 확장: 백화점 매장별 재고 5곳 + 신규 창고 컬럼 (CDV)
-- 매장 재고 > 0 = 백화점 판매 중 와인(소믈리에 추천 풀 기준)

alter table inventory_cdv
  add column if not exists store_hyundai_main real default 0,      -- 매장(현대본점)
  add column if not exists store_hyundai_jungdong real default 0,  -- 매장(현대중동점)
  add column if not exists store_hyundai_trade real default 0,     -- 매장(현대무역센터점)
  add column if not exists store_ssg_gangnam real default 0,       -- 매장(신세계강남점HOS)
  add column if not exists store_thehyundai real default 0,        -- 매장(더현대서울)
  add column if not exists hq_warehouse real default 0,            -- 본사창고(CDV)
  add column if not exists kctc_returns real default 0,            -- KCTC(반품창고)
  add column if not exists defective real default 0,               -- 불량
  add column if not exists old_discontinued real default 0,        -- OLD, 단종
  add column if not exists defective_leak real default 0,          -- 불량(누주)
  add column if not exists consignment_warehouse real default 0;   -- 위탁창고
