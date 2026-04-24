#!/usr/bin/env bash
# Order AI - Storage 자동 백업 스케줄 설치 (macOS launchd)
#
# 사용법: bash scripts/install-backup-schedule.sh
#
# 동작:
#   - plist 를 ~/Library/LaunchAgents/ 에 복사
#   - launchctl load -w 로 활성화
#   - 테스트 1회 즉시 실행
#
# 제거: bash scripts/install-backup-schedule.sh --uninstall

set -euo pipefail

PLIST_NAME="com.orderai.backup-storage.plist"
SRC="$(cd "$(dirname "$0")" && pwd)/backup-storage.launchd.plist"
DEST="$HOME/Library/LaunchAgents/$PLIST_NAME"
LABEL="com.orderai.backup-storage"

mkdir -p "$HOME/Library/LaunchAgents"

if [[ "${1:-}" == "--uninstall" ]]; then
  echo "📴 Uninstalling $LABEL ..."
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  launchctl unload -w "$DEST" 2>/dev/null || true
  rm -f "$DEST"
  echo "✅ Removed."
  exit 0
fi

if [[ ! -f "$SRC" ]]; then
  echo "❌ plist source not found: $SRC"
  exit 1
fi

echo "📦 Installing backup schedule..."
cp "$SRC" "$DEST"
echo "  → $DEST"

# 기존 로드된 게 있으면 해제
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true

# 로드
launchctl load -w "$DEST"
echo "✅ Loaded (will run daily at 03:00)"

# 로그 디렉터리 보장
mkdir -p "$(cd "$(dirname "$0")"/.. && pwd)/backups/logs"

echo ""
echo "📋 즉시 테스트 실행하려면:"
echo "   launchctl start $LABEL"
echo ""
echo "📖 로그 확인:"
echo "   tail -f backups/logs/backup-storage.log"
echo ""
echo "🗑  제거:"
echo "   bash scripts/install-backup-schedule.sh --uninstall"
