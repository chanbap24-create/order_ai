-- 거래처정보(DL/글라스) 업로드 대상. glass_clients 는 client_code·client_name 뿐이라
-- 거래처정보 마스터(담당자·업종·연락처·주소)를 담을 컬럼 추가. CDV/DL 코드공간 독립 유지
-- (와인 정보는 client_details, 글라스 정보는 glass_clients — 절대 섞지 않음).
alter table glass_clients
  add column if not exists manager text,
  add column if not exists business_type text,
  add column if not exists contact_name text,
  add column if not exists address text,
  add column if not exists updated_at timestamptz;
