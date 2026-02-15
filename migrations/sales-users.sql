-- ============================================================
-- Sales Users: 영업사원 로그인
-- Supabase SQL Editor에서 실행
-- ============================================================

CREATE TABLE IF NOT EXISTS sales_users (
  manager TEXT PRIMARY KEY,           -- 담당자명 (shipments.manager와 동일)
  password_hash TEXT NOT NULL,        -- SHA-256 해시
  role TEXT DEFAULT 'user',           -- 'admin' | 'user'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_users_role ON sales_users(role);
