-- 결제조건 + 입고일 → 수금 예정일 (주말 보정). lib/dueDate.ts 의 SQL 미러.
--  prepay: 입고일 / eom: 입고월 말일 / nme: 익월 말일
--  말일·익월말: 주말이면 직전 평일(←) / 익월N: 주말이면 직후 평일(→)
CREATE OR REPLACE FUNCTION public.fn_due_date(p_type text, p_delivery date)
RETURNS date LANGUAGE sql IMMUTABLE AS $function$
  SELECT CASE
    WHEN p_type IS NULL THEN NULL
    WHEN p_type = 'prepay' THEN p_delivery
    WHEN p_type IN ('eom','nme') THEN (
      SELECT CASE EXTRACT(DOW FROM le)::int WHEN 6 THEN le - 1 WHEN 0 THEN le - 2 ELSE le END
      FROM (SELECT (date_trunc('month', p_delivery)
              + (CASE WHEN p_type='nme' THEN interval '2 month' ELSE interval '1 month' END)
              - interval '1 day')::date AS le) x
    )
    WHEN p_type IN ('nm5','nm10','nm15','nm20') THEN (
      SELECT CASE EXTRACT(DOW FROM nd)::int WHEN 6 THEN nd + 2 WHEN 0 THEN nd + 1 ELSE nd END
      FROM (SELECT (date_trunc('month', p_delivery) + interval '1 month'
              + ((CASE p_type WHEN 'nm5' THEN 5 WHEN 'nm10' THEN 10 WHEN 'nm15' THEN 15 ELSE 20 END) - 1) * interval '1 day')::date AS nd) y
    )
    ELSE NULL
  END;
$function$;
