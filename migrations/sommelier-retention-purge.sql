-- 소믈리에 고객 개인정보 보유기간 파기 (동의서 고지: 마지막 방문일로부터 3년)
-- 적용: 2026-10-02 (Supabase MCP apply_migration) · 호출: /api/cron/sommelier-retention (매일 03:00 KST)
create or replace function public.purge_inactive_sommelier_customers(p_years int default 3, p_dry_run boolean default false)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_cutoff timestamptz := now() - make_interval(years => p_years);
  v_count integer;
begin
  with last_visit as (
    select c.id, greatest(c.updated_at, c.created_at,
      coalesce((select max(s.created_at) from sommelier_sessions s where s.customer_id = c.id), c.created_at),
      coalesce((select max(o.created_at) from sommelier_orders o where o.customer_id = c.id), c.created_at)) as last_at
    from sommelier_customers c
  ) select count(*) into v_count from last_visit where last_at < v_cutoff;

  if not p_dry_run and v_count > 0 then
    delete from sommelier_customers c using (
      select c2.id from sommelier_customers c2
      where greatest(c2.updated_at, c2.created_at,
        coalesce((select max(s.created_at) from sommelier_sessions s where s.customer_id = c2.id), c2.created_at),
        coalesce((select max(o.created_at) from sommelier_orders o where o.customer_id = c2.id), c2.created_at)) < v_cutoff
    ) t where c.id = t.id;
  end if;
  return v_count;
end; $$;
revoke all on function public.purge_inactive_sommelier_customers(int, boolean) from public, anon, authenticated;
