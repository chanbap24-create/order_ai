#!/bin/bash

# Order AI - 간단한 배포 스크립트
# 사용법: ./deploy.sh "커밋 메시지"

set -e

# 커밋 메시지 확인
if [ -z "$1" ]; then
  echo "❌ 커밋 메시지를 입력하세요!"
  echo "사용법: ./deploy.sh '수정 내용'"
  exit 1
fi

COMMIT_MSG="$1"

echo "📦 변경사항 커밋 중..."
git add .
git commit -m "$COMMIT_MSG" || echo "⚠️  변경사항 없음"

echo "🚀 GitHub에 푸시 중..."
git push origin main

echo ""
echo "✅ GitHub 푸시 완료!"
echo ""
echo "📋 다음 단계:"
echo "1. Vercel 대시보드 열기: https://vercel.com/dashboard"
echo "2. order-ai-final 프로젝트 → Deployments"
echo "3. 최신 배포 → ⋯ → Redeploy"
echo "4. 'Use existing Build Cache' 체크 해제 → Redeploy"
echo ""
echo "⏱️  약 2-3분 후 배포 완료!"
