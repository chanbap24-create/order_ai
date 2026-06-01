-- 수금 약속 금액 (수금약속일과 함께 지정)
ALTER TABLE public.collection_followups ADD COLUMN IF NOT EXISTS promised_amount bigint;
