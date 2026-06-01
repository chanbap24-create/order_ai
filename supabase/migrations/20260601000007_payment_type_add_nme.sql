-- 결제조건에 '익월말'(nme) 추가.
ALTER TABLE public.collection_followups DROP CONSTRAINT IF EXISTS collection_followups_payment_type_check;
ALTER TABLE public.collection_followups ADD CONSTRAINT collection_followups_payment_type_check
  CHECK (payment_type IS NULL OR payment_type IN ('prepay','eom','nm5','nm10','nm15','nm20','nme'));
