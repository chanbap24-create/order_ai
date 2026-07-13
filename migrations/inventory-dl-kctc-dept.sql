-- 글라스 재고(inventory_dl)에 KCTC 부서별 창고 컬럼 추가
-- 2026-07 ERP 글라스 재고 export 새 포맷: KCTC(마케팅부)/KCTC(영업2부) 등 창고가 추가됨.
-- HEADER_MAP은 KCTC(부서) 헤더를 yongma_* 컬럼(CDV 용마→KCTC 개명 호환)으로 매핑하는데
-- inventory_dl에 해당 컬럼이 없어 업로드 upsert가 실패했음 (테이블 삭제 후 실패 → 빈 재고 사고).
alter table inventory_dl add column if not exists yongma_reserve numeric;
alter table inventory_dl add column if not exists yongma_marketing numeric;
alter table inventory_dl add column if not exists yongma_sales1 numeric;
alter table inventory_dl add column if not exists yongma_sales2 numeric;
