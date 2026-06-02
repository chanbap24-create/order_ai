-- 글라스 미수 계산을 2025-08-01(전산이관일) 기준으로 고정.
-- 문제: 글라스 미수 RPC들이 2025-08 이전 출고의 total_amount까지 합산 → 대형계정 과다계상.
--   - calc_glass_aging / calc_glass_outstanding_v2: ref_date 를 MIN(created_at)(=2025-07)으로 잡음
--   - fn_client_balance_at / fn_collection_schedule: 글라스 분기에서 모든 과거 출고 합산
-- 옛 출고(2025-08 이전)는 이월(carryover)에 이미 반영되므로 이중계상.
-- 해결: 글라스는 이월 + (2025-08-01 이후 출고) - (2025-08-01 이후 수금). 와인은 미변경.
-- 검증: 라핀부쉬 89,100 / 28042 968,810,083 등 정본(신전산 원장 누계)과 533/536 일치.
--
-- 주: 이 4개 함수 본문은 Supabase apply_migration 으로 원격 DB에 이미 적용됨
--     (fix_glass_aging_ref_date_migration, fix_glass_outstanding_v2_ref_date_migration,
--      fix_client_balance_at_glass_migration_cutoff, fix_collection_schedule_glass_cutoff_migration).
--     본 파일은 레포 기록용. 전체 본문은 위 마이그레이션 또는 pg_get_functiondef 참고.

-- ① calc_glass_aging: ref CTE 를 고정일로
--    ref AS (SELECT DATE '2025-08-01' AS ref_date)

-- ② calc_glass_outstanding_v2: ref CTE 를 고정일로
--    ref AS (SELECT '2025-08-01' as ref_date)

-- ③ fn_client_balance_at (glass 분기): 출고/수금에 AND ship_date>=DATE '2025-08-01' / payment_date>=DATE '2025-08-01'

-- ④ fn_collection_schedule (glass net_now/net_close): 위와 동일 필터 추가
