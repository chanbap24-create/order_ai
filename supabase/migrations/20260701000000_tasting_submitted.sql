-- 시음주 결재 상신 상태: null=비상신, 값=상신완료(상신 시각).
ALTER TABLE public.saved_quotes ADD COLUMN IF NOT EXISTS tasting_submitted_at timestamptz;
