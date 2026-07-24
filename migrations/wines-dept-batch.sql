-- 2026-07 백화점 재고표 작업 표시 — 이번에 유입된 매장 판매 와인(승계+신규 등록) 추적용
alter table wines add column if not exists dept_batch boolean default false;
create index if not exists idx_wines_dept_batch on wines(dept_batch) where dept_batch;
