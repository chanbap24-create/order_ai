-- 임베딩 제공자 OpenAI(1536) → Voyage voyage-4-lite(1024) 전환.
-- 테이블 비어있어 컬럼 차원 변경 안전. 인덱스/RPC 재생성.
drop index if exists item_embeddings_hnsw;
drop function if exists match_items(text, vector, int);
alter table item_embeddings alter column embedding type vector(1024);

create index item_embeddings_hnsw
  on item_embeddings using hnsw (embedding vector_cosine_ops);

create or replace function match_items(p_tab text, p_query vector(1024), p_k int)
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
