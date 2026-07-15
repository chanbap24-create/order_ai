-- 그룹별 견적서 컬럼 구성(uiKey 배열, 순서 = 엑셀 열 순서). null = 계정 기본 컬럼 사용.
alter table client_groups add column if not exists columns jsonb;
