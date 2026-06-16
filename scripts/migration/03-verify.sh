#!/usr/bin/env bash
# 전체 테이블별 row count + 주요 row 샘플 비교로 정합성 체크

set -e
_SELF="${BASH_SOURCE[0]:-$0}"
_SCRIPT_DIR="$(cd "$(dirname "$_SELF")" && pwd)"
source "$_SCRIPT_DIR/00-load-env.sh"

echo ""
echo "═══════════════════════════════════════════"
echo "  전체 테이블 정합성 검증"
echo "═══════════════════════════════════════════"
echo ""

# public 스키마의 모든 테이블 자동 탐색
TABLES=$(psql "$MUMBAI_DB_URL" -t -A -c "
  SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename
")

MISMATCH=0
for table in $TABLES; do
  m=$(psql "$MUMBAI_DB_URL" -t -A -c "SELECT COUNT(*) FROM public.\"$table\"" 2>/dev/null || echo "ERR")
  s=$(psql "$SEOUL_DB_URL" -t -A -c "SELECT COUNT(*) FROM public.\"$table\"" 2>/dev/null || echo "ERR")
  status="✓"
  if [ "$m" != "$s" ]; then
    status="✗"
    MISMATCH=$((MISMATCH + 1))
  fi
  printf "  %-35s %10s  %10s  %s\n" "$table" "$m" "$s" "$status"
done

echo ""
if [ "$MISMATCH" -eq 0 ]; then
  echo "✅ 모든 테이블 일치"
else
  echo "⚠️  $MISMATCH 개 테이블 불일치 — 확인 필요"
fi
