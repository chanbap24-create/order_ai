-- 수금 워크플로우: 거래처별 독촉 단계·수금약속일·메모.
-- client_type 필수(까브드뱅/대유라이프 코드 체계 독립 → 법인 분리).
CREATE TABLE IF NOT EXISTS public.collection_followups (
  id           bigserial PRIMARY KEY,
  client_code  text NOT NULL,
  client_type  text NOT NULL CHECK (client_type IN ('wine','glass')),
  manager      text NOT NULL,
  stage        smallint NOT NULL DEFAULT 0,             -- 0=없음, 1/2/3=독촉 차수
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open','promised','paid','hold')),
  promised_date date,                                   -- 수금 약속일
  memo         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   text,
  UNIQUE (client_code, client_type)
);
CREATE INDEX IF NOT EXISTS idx_collection_followups_mgr ON public.collection_followups (manager, client_type);
