-- 지역(시도/구)별 매출 집계 RPC. 주소에서 시도·구 추출 후 shipments 매출 합산.
-- 주소 원천: 와인(CDV)=client_details(client_type='wine'), 글라스(DL)=glass_clients (별도 마스터).
-- 매출식은 app/lib/priceUtils.getSellingTotal 과 동일하게 복제(2025-08 전후 포맷 대응).
create or replace function fn_region_sales(p_type text, p_start text, p_end text)
returns table(sido text, gu text, sales numeric, clients bigint)
language plpgsql stable security definer set search_path = public as $func$
declare
  ship_table text := case when p_type = 'glass' then 'glass_shipments' else 'shipments' end;
  cd_sql text := case when p_type = 'glass'
    then 'select distinct on (client_code) client_code, address from glass_clients where coalesce(trim(address),'''') <> '''' order by client_code'
    else 'select distinct on (client_code) client_code, address from client_details where client_type=''wine'' and coalesce(trim(address),'''') <> '''' order by client_code'
  end;
begin
  return query execute format($q$
    with cd as ( %s ),
    r as (
      select s.client_code,
        case
          when cd.address like '서울%%' then '서울'
          when cd.address like '경기%%' then '경기'
          when cd.address like '인천%%' then '인천'
          when cd.address like '부산%%' then '부산'
          when cd.address like '대구%%' then '대구'
          when cd.address like '광주%%' then '광주'
          when cd.address like '대전%%' then '대전'
          when cd.address like '울산%%' then '울산'
          when cd.address like '세종%%' then '세종'
          when cd.address like '강원%%' then '강원'
          when cd.address like '제주%%' then '제주'
          when cd.address like '경상남%%' or cd.address like '경남%%' then '경남'
          when cd.address like '경상북%%' or cd.address like '경북%%' then '경북'
          when cd.address like '전라남%%' or cd.address like '전남%%' then '전남'
          when cd.address like '전라북%%' or cd.address like '전북%%' then '전북'
          when cd.address like '충청남%%' or cd.address like '충남%%' then '충남'
          when cd.address like '충청북%%' or cd.address like '충북%%' then '충북'
          else '기타'
        end as sido,
        case
          when split_part(cd.address,' ',2) like '%%구' then split_part(cd.address,' ',2)
          when split_part(cd.address,' ',2) like '%%시' and split_part(cd.address,' ',3) like '%%구' then split_part(cd.address,' ',2) || split_part(cd.address,' ',3)
          when split_part(cd.address,' ',2) like '%%시' or split_part(cd.address,' ',2) like '%%군' then split_part(cd.address,' ',2)
          else '(구외)'
        end as gu,
        case
          when coalesce(s.selling_price,0)=0 and coalesce(s.supply_amount,0)=0 then 0
          else (case when coalesce(s.quantity,0) < 0 then -1 else 1 end) *
            (case
              when abs(coalesce(s.quantity,0)) <= 1 then (case when abs(coalesce(s.selling_price,0))>0 then abs(coalesce(s.selling_price,0)) else abs(coalesce(s.unit_price,0)) end)
              when abs(coalesce(s.supply_amount,0))>0 and abs(coalesce(s.supply_amount,0))>abs(coalesce(s.selling_price,0)) and abs(abs(coalesce(s.selling_price,0))*abs(coalesce(s.quantity,0)) - abs(coalesce(s.supply_amount,0))) < 100 then abs(coalesce(s.supply_amount,0))
              when abs(coalesce(s.selling_price,0)) > abs(coalesce(s.unit_price,0))*2 and abs(coalesce(s.unit_price,0))>0 then abs(coalesce(s.selling_price,0))
              when abs(coalesce(s.selling_price,0))>0 then (case when abs(coalesce(s.selling_price,0))>abs(coalesce(s.unit_price,0)) then abs(coalesce(s.selling_price,0)) else abs(coalesce(s.selling_price,0))*abs(coalesce(s.quantity,0)) end)
              else abs(coalesce(s.unit_price,0))*abs(coalesce(s.quantity,0))
            end)
        end as rev
      from %I s
      join cd on cd.client_code = s.client_code
      where s.ship_date >= %L and s.ship_date <= %L
    )
    select sido, gu, round(sum(rev))::numeric as sales, count(distinct client_code) as clients
    from r
    group by sido, gu
  $q$, cd_sql, ship_table, p_start, p_end);
end
$func$;
