ALTER TABLE meetings ADD COLUMN IF NOT EXISTS manager TEXT DEFAULT '';

-- Backfill: client_details의 manager로 채우기
UPDATE meetings m
SET manager = COALESCE(
  (SELECT cd.manager FROM client_details cd WHERE cd.client_code = m.client_code LIMIT 1),
  ''
)
WHERE m.manager = '' OR m.manager IS NULL;
