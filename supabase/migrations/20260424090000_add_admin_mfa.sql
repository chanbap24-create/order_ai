-- Admin MFA (TOTP) 지원: sales_users 테이블에 컬럼 추가
--
-- totp_secret : base32 인코딩된 TOTP 시크릿 (최초 setup 시 생성, 암호화 없이
--               저장하지만 role='admin' 레코드만 해당하고 DB 서비스 키로만
--               접근 가능하므로 현재 위협 모델에서 충분).
-- totp_enabled : setup 완료 후 true. false 면 아직 MFA 미설정 상태.
-- totp_backup_codes : SHA-256 해시된 1회용 recovery codes 10개. TOTP 기기
--                     분실 시 사용. 사용된 코드는 배열에서 제거.

ALTER TABLE sales_users
  ADD COLUMN IF NOT EXISTS totp_secret TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS totp_backup_codes TEXT[];

-- admin 계정 row 가 이미 있다면 totp_enabled default false 로 그대로 유지.
-- 첫 로그인 후 /admin/mfa-setup 페이지에서 설정 강제 유도.
