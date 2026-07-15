-- 프로모션 대상 업태 지정: venue(업소/호텔)·shop(샵)·wholesale(도매). null/빈배열 = 전체 업태.
alter table promotions add column if not exists categories text[];
