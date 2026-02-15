-- ============================================================
-- grade_rules v2: 업종별 기준 + 리스팅 수 기준 추가
-- ============================================================

-- 1. 새 컬럼 추가
ALTER TABLE grade_rules
  ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT '_all',
  ADD COLUMN IF NOT EXISTS listing_vip INTEGER DEFAULT 15,
  ADD COLUMN IF NOT EXISTS listing_important INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS listing_normal INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS listing_occasional INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS listing_months INTEGER DEFAULT 6;

-- 2. 기존 UNIQUE 제약 변경 (manager, client_type) → (manager, client_type, business_type)
-- 기존 제약 삭제 후 새로 생성
ALTER TABLE grade_rules DROP CONSTRAINT IF EXISTS grade_rules_manager_client_type_key;
ALTER TABLE grade_rules ADD CONSTRAINT grade_rules_manager_client_type_biz_key
  UNIQUE (manager, client_type, business_type);

-- 3. 기존 _default 행에 business_type 설정 (이미 DEFAULT '_all'이지만 명시적)
UPDATE grade_rules SET business_type = '_all' WHERE business_type IS NULL;

-- 4. 기본값에 리스팅 기준 설정
UPDATE grade_rules
SET listing_vip = 15, listing_important = 10, listing_normal = 5, listing_occasional = 2, listing_months = 6
WHERE manager = '_default' AND client_type = 'wine';

UPDATE grade_rules
SET listing_vip = 10, listing_important = 7, listing_normal = 3, listing_occasional = 1, listing_months = 6
WHERE manager = '_default' AND client_type = 'glass';
