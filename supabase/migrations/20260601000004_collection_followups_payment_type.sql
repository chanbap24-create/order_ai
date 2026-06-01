-- 거래처별 결제 조건(수금일): 선결제/말일/익월5·10·15·20.
ALTER TABLE public.collection_followups
  ADD COLUMN IF NOT EXISTS payment_type text
  CHECK (payment_type IS NULL OR payment_type IN ('prepay','eom','nm5','nm10','nm15','nm20'));
