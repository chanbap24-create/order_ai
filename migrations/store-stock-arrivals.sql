-- 매장별 입고 기록 — 매장 재고가 0 → 1 이상이 된 날(= 그 매장 진열대에 들어온 날)을 남긴다.
-- 재고 엑셀은 매번 전체 교체(delete → insert)라 트리거로는 이전 수량을 알 수 없어,
-- 마지막으로 본 매장 수량을 이 테이블에 들고 있다가 fn_record_store_arrivals()가 현재 재고와 비교한다.
-- 법인 분리: corp = 'cdv'(inventory_cdv) / 'dl'(inventory_dl).
create table if not exists store_stock_arrivals (
  corp          text not null check (corp in ('cdv', 'dl')),
  store_col     text not null,              -- inventory_* 매장 컬럼명 (store_hyundai_main 등)
  item_no       text not null,
  qty           numeric not null default 0, -- 마지막으로 본 매장 수량
  first_seen    date not null,              -- 이 매장에서 처음 본 날
  last_arrived  date,                       -- 마지막으로 0 → 1+ 된 날 (기록 시작 전부터 있던 재고는 null)
  baseline      boolean not null default false, -- 기록 시작 시점에 이미 있던 재고(입고일 모름)
  updated_at    timestamptz not null default now(),
  primary key (corp, store_col, item_no)
);
create index if not exists store_stock_arrivals_arrived on store_stock_arrivals (store_col, last_arrived);
alter table store_stock_arrivals enable row level security;

create or replace function fn_record_store_arrivals()
returns table (side text, arrived_today int, skipped boolean)
language plpgsql
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date;
  c text;
  cur_n int; prev_n int; is_first boolean;
begin
  for c in select unnest(array['cdv', 'dl']) loop
    create temp table if not exists _cur (store_col text, item_no text, qty numeric) on commit drop;
    truncate _cur;
    if c = 'cdv' then
      insert into _cur
        select s.col, i.item_no, s.q from inventory_cdv i
        cross join lateral (values
          ('store_hyundai_main', i.store_hyundai_main), ('store_hyundai_jungdong', i.store_hyundai_jungdong),
          ('store_hyundai_trade', i.store_hyundai_trade), ('store_ssg_gangnam', i.store_ssg_gangnam),
          ('store_thehyundai', i.store_thehyundai)) s(col, q)
        where i.item_no is not null and coalesce(s.q, 0) > 0;
    else
      insert into _cur
        select s.col, i.item_no, s.q from inventory_dl i
        cross join lateral (values
          ('store_ssg_gangnam_dl', i.store_ssg_gangnam_dl::numeric), ('store_ssg_southcity', i.store_ssg_southcity::numeric)) s(col, q)
        where i.item_no is not null and coalesce(s.q, 0) > 0;
    end if;

    select count(*) into cur_n from _cur;
    select count(*) into prev_n from store_stock_arrivals a where a.corp = c and a.qty > 0;
    is_first := not exists (select 1 from store_stock_arrivals a where a.corp = c);

    -- 업로드 도중(전체 삭제 후 청크 적재 중)이면 매장 재고가 급감해 보인다 → 이번 회차는 건너뜀
    if cur_n = 0 or (prev_n > 0 and cur_n < prev_n * 0.5) then
      side := c; arrived_today := 0; skipped := true; return next; continue;
    end if;

    -- 새로 본 (매장, 품번): 첫 기록이면 기준선(입고일 모름), 아니면 오늘 입고
    insert into store_stock_arrivals as a (corp, store_col, item_no, qty, first_seen, last_arrived, baseline)
      select c, x.store_col, x.item_no, x.qty, today, case when is_first then null else today end, is_first
      from _cur x
    on conflict (corp, store_col, item_no) do update
      set last_arrived = case when a.qty <= 0 then today else a.last_arrived end, -- 0 → 1+ 재입고
          qty = excluded.qty, updated_at = now();

    -- 이번 재고에 없는 (매장, 품번) = 매장 품절
    update store_stock_arrivals a set qty = 0, updated_at = now()
      where a.corp = c and a.qty > 0
        and not exists (select 1 from _cur x where x.store_col = a.store_col and x.item_no = a.item_no);

    side := c;
    select count(*) into arrived_today from store_stock_arrivals a where a.corp = c and a.last_arrived = today;
    skipped := false;
    return next;
  end loop;
end;
$$;

revoke all on function fn_record_store_arrivals() from public, anon, authenticated;
