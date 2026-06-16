-- order-v2 발주 파싱 호출 로그 — 에스컬레이션 비율/비용 집계용
CREATE TABLE IF NOT EXISTS public.order_parse_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  tab text,
  escalated boolean NOT NULL DEFAULT false,
  final_model text,
  base_input integer NOT NULL DEFAULT 0,
  base_output integer NOT NULL DEFAULT 0,
  base_cache_read integer NOT NULL DEFAULT 0,
  esc_input integer NOT NULL DEFAULT 0,
  esc_output integer NOT NULL DEFAULT 0,
  esc_cache_read integer NOT NULL DEFAULT 0,
  line_count integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_order_parse_log_created ON public.order_parse_log (created_at);
COMMENT ON TABLE public.order_parse_log IS 'order-v2 발주 파싱 호출 로그 — 에스컬레이션 비율/비용 집계용';
