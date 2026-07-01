-- 시음주 결재 상신 추적(출고내역 기반). 자연키 = 출고일 + 거래처 + 품번.
-- saved_quotes.tasting_submitted_at 대신, 실제 출고내역 시음주도 상신관리 가능하게 별도 테이블.
create table if not exists public.tasting_submissions (
  ship_date    text        not null,
  client_code  text        not null,
  item_no      text        not null,
  company      text        not null default 'CDV', -- CDV(와인) | DL(글라스)
  submitted_at timestamptz not null default now(),
  submitted_by text,
  primary key (company, ship_date, client_code, item_no)
);
