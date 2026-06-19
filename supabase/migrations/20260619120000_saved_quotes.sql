-- 저장 견적(견적 이력): 인벤토리에서 견적서를 내보낼 때 담당·거래처별 스냅샷 저장.
CREATE TABLE IF NOT EXISTS public.saved_quotes (
  id           bigint generated always as identity primary key,
  manager      text  not null default '',
  client_code  text,
  client_name  text  not null default '',
  company      text,                                  -- 'CDV' | 'DL'
  item_count   int   not null default 0,
  total_supply numeric not null default 0,            -- 공급가 합계(목록 표시용)
  items        jsonb not null default '[]'::jsonb,    -- QuoteItem[] 스냅샷
  doc_settings jsonb,                                 -- 문서 설정 스냅샷
  columns      jsonb,                                 -- 표시 컬럼 스냅샷
  created_at   timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_saved_quotes_manager ON public.saved_quotes (manager, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_quotes_client_code ON public.saved_quotes (client_code);
