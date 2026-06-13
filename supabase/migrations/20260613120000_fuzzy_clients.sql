-- 거래처 퍼지 검색: 스크린샷 힌트의 오타/띄어쓰기 흡수.
-- 정규화(소문자 + 공백 제거) 후 word_similarity(부분 일치)로 후보를 찾는다.
-- "주식회사" 같은 접두어가 있어도 핵심어 힌트가 잘 매칭되도록 word_similarity 사용.
-- CDV=clients, DL=glass_clients. 라우트(/api/order-v2/clients)에서 결과가 적을 때 폴백 호출.
create extension if not exists pg_trgm;

create or replace function fuzzy_clients(p_q text, p_glass boolean, p_limit int default 8)
returns table(client_code text, client_name text, sim real)
language sql stable
security definer
set search_path = public
as $$
  with nq as (select lower(regexp_replace(coalesce(p_q,''), '[[:space:]]', '', 'g')) as q),
  src as (
    select client_code, client_name, lower(regexp_replace(client_name, '[[:space:]]', '', 'g')) as nn
    from clients where not p_glass
    union all
    select client_code, client_name, lower(regexp_replace(client_name, '[[:space:]]', '', 'g'))
    from glass_clients where p_glass
  )
  select s.client_code, s.client_name,
         greatest(word_similarity((select q from nq), s.nn),
                  word_similarity(s.nn, (select q from nq))) as sim
  from src s
  where (select length(q) from nq) >= 2
    and greatest(word_similarity((select q from nq), s.nn),
                 word_similarity(s.nn, (select q from nq))) > 0.4
  order by sim desc
  limit p_limit;
$$;
