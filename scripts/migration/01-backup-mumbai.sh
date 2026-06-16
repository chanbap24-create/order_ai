#!/usr/bin/env bash
# Mumbai DB 전체 백업 (스키마 + 데이터 + roles/grants)
# 이전 중 문제 생겨도 복원 가능. 1단계: 안전장치.

set -e
_SELF="${BASH_SOURCE[0]:-$0}"
_SCRIPT_DIR="$(cd "$(dirname "$_SELF")" && pwd)"
source "$_SCRIPT_DIR/00-load-env.sh"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$(cd "$_SCRIPT_DIR/../.." && pwd)/backups"
SCHEMA_FILE="$BACKUP_DIR/mumbai_schema_${TIMESTAMP}.sql"
DATA_FILE="$BACKUP_DIR/mumbai_data_${TIMESTAMP}.sql"
ROLES_FILE="$BACKUP_DIR/mumbai_roles_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

echo ""
echo "═══════════════════════════════════════════"
echo "  Mumbai DB 백업 시작"
echo "═══════════════════════════════════════════"
echo ""

echo "[1/3] 스키마 덤프..."
pg_dump "$MUMBAI_DB_URL" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --schema=public \
  > "$SCHEMA_FILE"
echo "    → $SCHEMA_FILE ($(wc -l < "$SCHEMA_FILE") lines)"

echo ""
echo "[2/3] 데이터 덤프 (시간 오래 걸림 ≈ 5~15분)..."
pg_dump "$MUMBAI_DB_URL" \
  --data-only \
  --no-owner \
  --no-privileges \
  --disable-triggers \
  --schema=public \
  > "$DATA_FILE"
SIZE=$(du -h "$DATA_FILE" | cut -f1)
echo "    → $DATA_FILE ($SIZE)"

echo ""
echo "[3/3] (선택) roles/grants — Supabase는 managed라 실패 가능, 무시"
pg_dump "$MUMBAI_DB_URL" \
  --schema-only \
  --no-owner \
  --schema=storage 2>/dev/null > "$ROLES_FILE" || true

echo ""
echo "═══════════════════════════════════════════"
echo "  백업 완료"
echo "═══════════════════════════════════════════"
echo "  스키마: $SCHEMA_FILE"
echo "  데이터: $DATA_FILE"
echo ""
echo "다음 단계: ./02-migrate-to-seoul.sh"
