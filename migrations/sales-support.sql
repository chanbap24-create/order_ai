-- ============================================================
-- Sales Support System: 영업지원 테이블
-- Supabase SQL Editor에서 실행
-- ============================================================

-- ── 1. 거래처 상세정보 ──
CREATE TABLE IF NOT EXISTS client_details (
  client_code TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_type TEXT DEFAULT 'wine',          -- 'wine' | 'glass'
  importance INTEGER DEFAULT 3,             -- 1(VIP) ~ 5(일반)
  contact_name TEXT,                        -- 담당자명
  contact_phone TEXT,                       -- 전화번호
  contact_email TEXT,
  address TEXT,
  business_type TEXT,                       -- 업종 (레스토랑, 호텔, 바 등)
  manager TEXT,                             -- 우리측 담당자
  memo TEXT,                                -- 메모
  visit_cycle_days INTEGER DEFAULT 30,      -- 방문 주기 (일)
  last_visit_date DATE,
  next_visit_date DATE,
  tags TEXT[] DEFAULT '{}',                 -- 태그 (예: '이탈리안', '프렌치', '내추럴와인')
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_details_importance ON client_details(importance);
CREATE INDEX IF NOT EXISTS idx_client_details_manager ON client_details(manager);
CREATE INDEX IF NOT EXISTS idx_client_details_type ON client_details(client_type);
CREATE INDEX IF NOT EXISTS idx_client_details_next_visit ON client_details(next_visit_date);

-- ── 2. 미팅/방문 기록 ──
CREATE TABLE IF NOT EXISTS meetings (
  id SERIAL PRIMARY KEY,
  client_code TEXT REFERENCES client_details(client_code) ON DELETE CASCADE,
  meeting_date DATE NOT NULL,
  meeting_time TEXT,                        -- '14:00'
  meeting_type TEXT DEFAULT 'visit',        -- 'visit' | 'call' | 'tasting' | 'delivery'
  status TEXT DEFAULT 'planned',            -- 'planned' | 'confirmed' | 'completed' | 'cancelled'
  purpose TEXT,                             -- 미팅 목적
  prepared_items TEXT[] DEFAULT '{}',       -- 준비할 와인 품번 목록
  quote_id INTEGER,                        -- 연결된 견적서
  notes TEXT,                              -- 미팅 후 메모
  ai_briefing JSONB,                       -- AI가 생성한 브리핑 데이터
  kakao_message TEXT,                      -- 카톡 발송용 문구
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_client ON meetings(client_code);
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);

-- ── 3. AI 추천 기록 ──
CREATE TABLE IF NOT EXISTS recommendations (
  id SERIAL PRIMARY KEY,
  client_code TEXT REFERENCES client_details(client_code) ON DELETE CASCADE,
  item_codes TEXT[] NOT NULL DEFAULT '{}',  -- 추천 와인 품번들
  reason TEXT,                              -- 추천 사유
  recommendation_type TEXT,                 -- 'reorder' | 'new_trial' | 'upsell' | 'seasonal'
  status TEXT DEFAULT 'pending',            -- 'pending' | 'sent' | 'accepted' | 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recommendations_client ON recommendations(client_code);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_type ON recommendations(recommendation_type);

-- ── 4. 재고 알림 ──
CREATE TABLE IF NOT EXISTS inventory_alerts (
  id SERIAL PRIMARY KEY,
  item_no TEXT NOT NULL,
  item_name TEXT,
  alert_type TEXT,                          -- 'low_stock' | 'out_of_stock' | 'new_arrival'
  current_stock INTEGER,
  threshold INTEGER,
  affected_clients TEXT[] DEFAULT '{}',     -- 이 와인을 구매하는 거래처들
  status TEXT DEFAULT 'active',             -- 'active' | 'acknowledged' | 'resolved'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_alerts_item ON inventory_alerts(item_no);
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_status ON inventory_alerts(status);
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_type ON inventory_alerts(alert_type);

-- ── updated_at 자동 갱신 함수 ──
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거: client_details
DROP TRIGGER IF EXISTS trg_client_details_updated ON client_details;
CREATE TRIGGER trg_client_details_updated
  BEFORE UPDATE ON client_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 트리거: meetings
DROP TRIGGER IF EXISTS trg_meetings_updated ON meetings;
CREATE TRIGGER trg_meetings_updated
  BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 마이그레이션 완료!
-- ============================================================
