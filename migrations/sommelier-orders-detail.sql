-- 소믈리에 구매 기록 상세화 — 취향 학습(문답 이력 × 구매) 뼈대용.
-- 한 번의 '판매 완료' = sale_id 하나(결제 단위). 와인 속성·맛 프로필은 구매 시점 스냅샷(이후 데이터 수정과 무관).
-- 기존 retail_price는 '최종 결제 단가'(하위호환) — unit_price와 같은 값.
-- 적용: 2026-10-02 (Supabase MCP apply_migration)
alter table public.sommelier_orders
  add column if not exists sale_id uuid,                 -- 결제 단위(같은 판매 완료의 품목들)
  add column if not exists store_key text,               -- 판매 매장
  add column if not exists corp text,                    -- 법인 cdv/dl
  add column if not exists source text,                  -- 'quiz'(추천 문답에서 담음) | 'stock'(재고에서 직접 선택)
  add column if not exists rec_rank integer,             -- 추천 결과 순위(문답 추천에서 담았을 때)
  add column if not exists recommended boolean,          -- 직전 문답 추천 결과에 있던 와인인지
  add column if not exists vintage text,
  add column if not exists wine_type text,
  add column if not exists country text,
  add column if not exists region text,
  add column if not exists grapes text,
  add column if not exists brand text,
  add column if not exists producer text,
  add column if not exists list_price numeric,           -- 정상가
  add column if not exists dept_price numeric,           -- 백화점가(밴드 할인 적용)
  add column if not exists unit_price numeric,           -- 최종 결제 단가(추가 할인 배분 후)
  add column if not exists discount_rate numeric,        -- 정상가 대비 총 할인율(%)
  add column if not exists amount numeric,               -- 최종 단가 × 수량
  add column if not exists extra_discount_rate numeric,  -- 이 판매의 추가 할인(%)
  add column if not exists extra_discount_won numeric,   -- 이 판매의 추가 할인(원)
  add column if not exists body smallint,                -- 맛 프로필(테이스팅 노트 1~5)
  add column if not exists sweetness smallint,
  add column if not exists acidity smallint,
  add column if not exists tannin smallint,
  add column if not exists flavor_tags text[];
-- 같은 판매의 같은 와인은 1행(재시도해도 중복 안 쌓임). 부분 인덱스는 upsert 충돌 대상으로 못 쓰므로 전체 인덱스
-- (sale_id가 null인 옛 기록끼리는 NULL≠NULL이라 충돌 없음)
create unique index if not exists sommelier_orders_sale_item_uniq
  on public.sommelier_orders (sale_id, item_code);
create index if not exists sommelier_orders_created_idx on public.sommelier_orders (created_at desc);
