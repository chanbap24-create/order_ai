-- 시음주 자동등록 기능 기반:
--  1) saved_quotes.is_tasting — 시음주 견적(100%할인 1병) 구분
--  2) client_tasting_policy   — 거래처별 on/off·월 병수한도·금액상한·선정방식
--  3) tasting_monthly_pick    — '이달의 시음주' 지정(법인/담당 단위)

ALTER TABLE public.saved_quotes ADD COLUMN IF NOT EXISTS is_tasting boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_saved_quotes_tasting ON public.saved_quotes (client_code, is_tasting, created_at);

CREATE TABLE IF NOT EXISTS public.client_tasting_policy (
  client_code text NOT NULL,
  client_type text NOT NULL CHECK (client_type IN ('wine','glass')),
  enabled boolean NOT NULL DEFAULT false,         -- 월 자동배치 등록 on/off
  monthly_qty_limit int NOT NULL DEFAULT 2,        -- 월 병수 상한
  monthly_amount_limit numeric,                    -- 월 금액(공급가) 상한, null=무제한
  selection_mode text NOT NULL DEFAULT 'recommend' -- recommend|manual|monthly
    CHECK (selection_mode IN ('recommend','manual','monthly')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  PRIMARY KEY (client_code, client_type)
);

CREATE TABLE IF NOT EXISTS public.tasting_monthly_pick (
  id bigserial PRIMARY KEY,
  ym text NOT NULL,                                -- 'YYYY-MM'
  company text NOT NULL CHECK (company IN ('CDV','DL')),
  manager text,                                    -- null=법인 공통, 값=담당자 전용
  item_no text NOT NULL,
  item_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasting_pick_lookup ON public.tasting_monthly_pick (ym, company);
