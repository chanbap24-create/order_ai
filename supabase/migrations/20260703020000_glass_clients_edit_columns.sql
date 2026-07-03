-- 글라스 거래처정보 편집(상세 패널) 지원. 거래처정보 표시/편집이 glass_clients 로 라우팅되므로
-- client_details 의 편집 컬럼과 맞춤(연락처 전화/이메일·메모·중요도). CDV/DL 코드공간 독립 유지.
alter table glass_clients
  add column if not exists contact_phone text,
  add column if not exists contact_email text,
  add column if not exists memo text,
  add column if not exists importance integer default 3;
