#!/bin/bash

echo "🔍 SQLite Write 작업이 있는 API 찾기..."

# Write 작업이 있는 파일 찾기
grep -r "\.run(" app/api --include="*.ts" -l | while read file; do
  echo "  ❌ $file"
done

echo ""
echo "📝 수정이 필요한 API:"
echo "  - /api/learn-client ✅ (이미 수정됨)"
echo "  - /api/learn-item-alias"
echo "  - /api/delete-item-alias"
echo "  - /api/confirm-item-alias"
echo "  - /api/learn-new-item"
echo "  - /api/auto-learn"
echo ""
echo "⚠️  이 API들은 모두 클라이언트에서 localStorage로 관리해야 합니다."
echo ""
