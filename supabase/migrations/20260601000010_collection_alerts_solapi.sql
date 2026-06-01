-- 카카오 알림톡(Solapi) 수금 연체 알림용.
-- 매니저 알림톡 수신 전화번호
ALTER TABLE public.sales_users ADD COLUMN IF NOT EXISTS phone text;

-- 수금 알림 발송 로그 (매니저·일자별 1회 — 중복 발송 방지)
CREATE TABLE IF NOT EXISTS public.collection_alert_log (
  id         bigserial PRIMARY KEY,
  manager    text NOT NULL,
  sent_date  date NOT NULL,
  channel    text NOT NULL DEFAULT 'alimtalk',
  count      int,
  status     text,
  detail     text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manager, sent_date, channel)
);
