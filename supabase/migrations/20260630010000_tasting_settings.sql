-- 시음주 선정 설정(법인별): 재고/가격/와인타입 필터. 추천 모드 후보를 이 조건으로 거른다.
CREATE TABLE IF NOT EXISTS public.tasting_settings (
  company text PRIMARY KEY CHECK (company IN ('CDV','DL')),
  min_stock int NOT NULL DEFAULT 1,        -- 최소 가용재고(이상)
  price_min numeric,                        -- 공급가 하한(이상), null=무제한
  price_max numeric,                        -- 공급가 상한(이하), null=무제한
  wine_types text[] NOT NULL DEFAULT '{}',  -- 허용 타입(레드/화이트/스파클링/로제/주정강화). 빈 배열=전체
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
