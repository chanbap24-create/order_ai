-- 프로모션 상세페이지(/promo) 노출 선택 — 활성 프로모션 중 페이지에 실을 와인만 고른다.
alter table promotions add column if not exists page_visible boolean not null default true;
