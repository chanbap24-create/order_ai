-- 담당자별 거래처 목록(중복 제거) RPC.
-- 기존 orderClients.ts는 glass_shipments/client_details를 .limit(8000) 원행으로 읽어
-- 출고가 많은 담당자(예: 조성재 17,443행)의 거래처 40%가 스코프 집합에서 누락됐음.
-- DISTINCT로 담당자의 전체 거래처를 정확히 반환한다.
-- DL(글라스)=glass_shipments.manager, CDV(와인)=client_details.manager(client_type='wine').
create or replace function manager_clients(p_manager text, p_glass boolean)
returns table(client_code text, client_name text)
language sql stable
security definer
set search_path = public
as $$
  select g.client_code, g.client_name from (
    select distinct on (client_code) client_code, client_name
    from glass_shipments
    where p_glass and manager = p_manager and coalesce(nullif(trim(client_code), ''), '') <> ''
    order by client_code, ctid
  ) g
  union all
  select c.client_code, c.client_name from (
    select distinct on (client_code) client_code, coalesce(client_name, client_code) as client_name
    from client_details
    where (not p_glass) and manager = p_manager and client_type = 'wine'
      and coalesce(nullif(trim(client_code), ''), '') <> ''
    order by client_code, ctid
  ) c
$$;
