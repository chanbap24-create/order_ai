-- 글라스(DL) 담당자별 매출 — 실제 담당(glass_shipments.manager)으로 집계.
-- 매출분석 mgr_agg는 글라스인데도 client_details(와인) 담당을 참조 → 코드 체계 독립이라 오귀속
-- (조성재 DL 15.4억으로 과다). 글라스는 f.manager 직접 사용 + 2025-08 이관 컷오프.
create or replace function fn_glass_manager_sales(p_start text, p_end text)
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(m) order by m.revenue desc), '[]'::json)
  from (
    select coalesce(nullif(manager, ''), '(미지정)') as manager,
           count(distinct client_code) as "clientCount",
           round(sum(case when ship_date >= '2025-08-01'::date then supply_amount::numeric
                          else coalesce(nullif(selling_price,0)::numeric, supply_amount::numeric, 0) end)) as revenue
    from glass_shipments
    where ship_date >= greatest(p_start, '2025-08-01')::date and ship_date <= p_end::date
    group by 1
  ) m;
$$;
