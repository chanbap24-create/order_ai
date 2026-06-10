-- 테이스팅노트 목록에서 제외할 품목 플래그 (자재/세트 등 노트 불필요 품목 정리용)
ALTER TABLE wines ADD COLUMN IF NOT EXISTS note_excluded boolean NOT NULL DEFAULT false;
