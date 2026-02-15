-- ============================================================
-- 담당별 거래처 등급 기준 테이블
-- ============================================================

CREATE TABLE IF NOT EXISTS grade_rules (
  id SERIAL PRIMARY KEY,
  manager TEXT NOT NULL,                    -- 담당자명 (또는 '_default' 기본값)
  client_type TEXT DEFAULT 'wine',          -- 'wine' | 'glass'
  -- 등급 경계값 (연간 매출 기준, 이상)
  vip_threshold BIGINT DEFAULT 100000000,       -- 1등급(VIP): 1억 이상
  important_threshold BIGINT DEFAULT 50000000,  -- 2등급(중요): 5천만 이상
  normal_threshold BIGINT DEFAULT 10000000,     -- 3등급(일반): 1천만 이상
  occasional_threshold BIGINT DEFAULT 1000000,  -- 4등급(간헐): 100만 이상
  -- 4등급 미만 → 5등급(비활성)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(manager, client_type)
);

-- 기본 기준값 삽입
INSERT INTO grade_rules (manager, client_type, vip_threshold, important_threshold, normal_threshold, occasional_threshold)
VALUES ('_default', 'wine', 100000000, 50000000, 10000000, 1000000)
ON CONFLICT (manager, client_type) DO NOTHING;

INSERT INTO grade_rules (manager, client_type, vip_threshold, important_threshold, normal_threshold, occasional_threshold)
VALUES ('_default', 'glass', 50000000, 20000000, 5000000, 500000)
ON CONFLICT (manager, client_type) DO NOTHING;
