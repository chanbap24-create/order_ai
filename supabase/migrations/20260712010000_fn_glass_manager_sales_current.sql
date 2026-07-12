-- 글라스 담당자별 매출 — '현재 담당(glass_clients.manager)' 기준.
--  정책: 거래처 담당이 바뀌면 그 거래처의 과거 매출도 옛 담당에서 빠지고 현재 담당에 귀속된다.
--   (거래처정보 업로드로 glass_clients.manager를 최신 유지 → 이 값이 현재 담당.)
--   현재 담당이 미지정인 거래처만 출고 당시 담당(gs.manager)으로 폴백.
--  · 지원률(정상공급가 대비 판매 할인율) 포함. 정상가 = inventory_dl.supply_price × 수량.
--  · 2025-08-01 전산이관 컷오프 유지(이관 전 출고 제외).
create or replace function fn_glass_manager_sales(p_start text, p_end text)
returns json language sql stable security definer set search_path = public as $$
  with base as (
    select coalesce(nullif(gc.manager,''), nullif(gs.manager,''),'(미지정)') as manager,
           gs.client_code,
           case when gs.ship_date >= '2025-08-01'::date then gs.supply_amount::numeric
                else coalesce(nullif(gs.selling_price,0)::numeric, gs.supply_amount::numeric, 0) end as rev,
           case when gs.ship_date >= '2025-08-01'::date and i.supply_price > 0 and gs.selling_price > 0 and gs.quantity > 0
                then i.supply_price::numeric * gs.quantity else 0 end as normal_amt,
           case when gs.ship_date >= '2025-08-01'::date and i.supply_price > 0 and gs.selling_price > 0 and gs.quantity > 0
                then gs.selling_price::numeric * gs.quantity else 0 end as selling_amt
    from glass_shipments gs
    left join glass_clients gc on gc.client_code = gs.client_code
    left join inventory_dl i on i.item_no = gs.item_no
    where gs.ship_date >= greatest(p_start, '2025-08-01')::date and gs.ship_date <= p_end::date
  )
  select coalesce(json_agg(row_to_json(m) order by m.revenue desc), '[]'::json)
  from (
    select manager,
           count(distinct client_code) as "clientCount",
           round(sum(rev)) as revenue,
           case when sum(normal_amt) > 0
                then round(((sum(normal_amt) - sum(selling_amt)) / nullif(sum(normal_amt),0)) * 1000) / 10.0
                else null end as "discountRate"
    from base group by manager
  ) m;
$$;
