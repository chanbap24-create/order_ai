-- 재고에 박스당 입수량(IP) + 단위 컬럼 추가.
-- 글라스 발주 "0884/0 3박스" → 박스당개수(units_per_box)로 잔 수 환산 (3 × 6 = 18잔).
-- 업로드 헤더 'IP'/'입수' → units_per_box, '단위' → unit (inventoryHeaders.ts HEADER_MAP).
alter table inventory_dl  add column if not exists units_per_box real;
alter table inventory_dl  add column if not exists unit text;
alter table inventory_cdv add column if not exists units_per_box real;
alter table inventory_cdv add column if not exists unit text;
