-- 거래처 상태(정상/폐업/휴업/사용안함) — ERP 거래처정보 업로드에서 채움.
-- order 검색 시 '정상'만 노출(비정상 제외). client_details=와인, glass_clients=글라스.
alter table client_details add column if not exists status text;
alter table glass_clients add column if not exists status text;
