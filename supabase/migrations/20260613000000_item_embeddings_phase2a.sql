-- Phase 2a: 발주 후보 사전축소용 품목 임베딩 인프라
-- (LLM에 전체 카탈로그 대신 의미 검색으로 관련 품목만 전달 — Phase 2b 에서 사용)
create extension if not exists vector;

create table if not exists item_embeddings (
  tab        text not null,        -- 'CDV' | 'DL'
  item_no    text not null,
  item_name  text not null,
  content    text not null,        -- 임베딩 입력 텍스트 (변경 감지용)
  embedding  vector(1536),         -- OpenAI text-embedding-3-small
  updated_at timestamptz not null default now(),
  primary key (tab, item_no)
);

create index if not exists item_embeddings_hnsw
  on item_embeddings using hnsw (embedding vector_cosine_ops);

-- 의미 검색 RPC
create or replace function match_items(p_tab text, p_query vector(1536), p_k int)
returns table(item_no text, item_name text, similarity double precision)
language sql stable
security definer
set search_path = public
as $$
  select e.item_no, e.item_name, 1 - (e.embedding <=> p_query) as similarity
  from item_embeddings e
  where e.tab = p_tab and e.embedding is not null
  order by e.embedding <=> p_query
  limit p_k;
$$;
