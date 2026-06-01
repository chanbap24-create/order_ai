-- 분할상환 등 입금예정금액을 직접 입력하는 거래처 표시 (수금일정표 자동계산 제외)
ALTER TABLE public.collection_followups ADD COLUMN IF NOT EXISTS manual_amount boolean NOT NULL DEFAULT false;
