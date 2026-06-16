#!/usr/bin/env bash
# Mumbai → Seoul 이전: 최신 백업 파일을 Seoul에 복원 + 검증

set -e
_SELF="${BASH_SOURCE[0]:-$0}"
_SCRIPT_DIR="$(cd "$(dirname "$_SELF")" && pwd)"
source "$_SCRIPT_DIR/00-load-env.sh"

BACKUP_DIR="$(cd "$_SCRIPT_DIR/../.." && pwd)/backups"
SCHEMA_FILE=$(ls -t "$BACKUP_DIR"/mumbai_schema_*.sql 2>/dev/null | head -1)
DATA_FILE=$(ls -t "$BACKUP_DIR"/mumbai_data_*.sql 2>/dev/null | head -1)

if [ -z "$SCHEMA_FILE" ] || [ -z "$DATA_FILE" ]; then
  echo "ERROR: 백업 파일 없음. 먼저 ./01-backup-mumbai.sh 실행"
  exit 1
fi

echo ""
echo "═══════════════════════════════════════════"
echo "  Seoul에 복원 시작"
echo "═══════════════════════════════════════════"
echo "  스키마: $(basename $SCHEMA_FILE)"
echo "  데이터: $(basename $DATA_FILE) ($(du -h $DATA_FILE | cut -f1))"
echo ""
read -p "  계속하시겠습니까? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "취소됨"
  exit 0
fi

echo ""
echo "[1/4] Seoul 기존 스키마 비우기 (public 스키마만)..."
psql "$SEOUL_DB_URL" -v ON_ERROR_STOP=1 -c "
  DROP SCHEMA IF EXISTS public CASCADE;
  CREATE SCHEMA public;
  GRANT ALL ON SCHEMA public TO postgres;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
" 2>&1 | tail -5

echo ""
echo "[2/4] 스키마 복원 (테이블/인덱스/함수)..."
psql "$SEOUL_DB_URL" -v ON_ERROR_STOP=0 -f "$SCHEMA_FILE" 2>&1 | \
  grep -E "^(ERROR|NOTICE)" | head -20 || true
echo "    → 스키마 복원 완료"

echo ""
echo "[3/4] 데이터 복원 (5~15분 소요)..."
psql "$SEOUL_DB_URL" -v ON_ERROR_STOP=0 -f "$DATA_FILE" 2>&1 | \
  grep -E "^(ERROR)" | head -20 || true
echo "    → 데이터 복원 완료"

echo ""
echo "[4/4] 검증 — 주요 테이블 row count 비교"
echo ""
echo "  테이블명          Mumbai     Seoul      일치"
echo "  ─────────────────────────────────────────────"
for table in shipments glass_shipments meetings client_details glass_clients payments sales_users holidays; do
  mumbai_cnt=$(psql "$MUMBAI_DB_URL" -t -A -c "SELECT COUNT(*) FROM public.$table" 2>/dev/null || echo "N/A")
  seoul_cnt=$(psql "$SEOUL_DB_URL" -t -A -c "SELECT COUNT(*) FROM public.$table" 2>/dev/null || echo "N/A")
  status="✓"
  if [ "$mumbai_cnt" != "$seoul_cnt" ]; then status="✗ MISMATCH"; fi
  printf "  %-18s %-10s %-10s %s\n" "$table" "$mumbai_cnt" "$seoul_cnt" "$status"
done

echo ""
echo "═══════════════════════════════════════════"
echo "  이전 완료"
echo "═══════════════════════════════════════════"
echo ""
echo "다음 단계:"
echo "  1. .env.local 환경변수 Seoul로 교체 (아래 참고)"
echo "  2. Vercel Dashboard에서 환경변수 교체"
echo "  3. Vercel redeploy"
echo "  4. 1~3일 관찰 후 Mumbai 프로젝트 삭제"
echo ""
echo "=== .env.local 교체 예시 ==="
echo "SUPABASE_URL=$SEOUL_URL"
echo "SUPABASE_SERVICE_ROLE_KEY=<Seoul service_role key>"
echo "SUPABASE_DB_URL=$SEOUL_DB_URL"
