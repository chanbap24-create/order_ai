#!/bin/bash

echo "🧪 Vercel 배포 테스트 스크립트"
echo ""
echo "사용 방법:"
echo "  ./test-vercel-deployment.sh https://your-app.vercel.app"
echo ""

if [ -z "$1" ]; then
    echo "❌ Vercel URL을 입력하세요"
    echo "   예: ./test-vercel-deployment.sh https://order-ai-five.vercel.app"
    exit 1
fi

VERCEL_URL="$1"
API_URL="$VERCEL_URL/api/parse-full-order"

echo "📍 테스트 URL: $API_URL"
echo ""

echo "1️⃣ GET 요청 테스트..."
response=$(curl -s -w "\n%{http_code}" "$API_URL")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

echo "   HTTP Status: $http_code"

if [ "$http_code" = "200" ]; then
    echo "   ✅ GET 요청 성공!"
    echo "   응답: $body"
else
    echo "   ❌ GET 요청 실패"
    echo "   응답: $body"
fi

echo ""
echo "2️⃣ POST 요청 테스트..."
post_response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d '{"message":"샤블리 6병"}')
    
post_http_code=$(echo "$post_response" | tail -n1)
post_body=$(echo "$post_response" | head -n-1)

echo "   HTTP Status: $post_http_code"

if [ "$post_http_code" = "200" ]; then
    echo "   ✅ POST 요청 성공!"
    echo "   응답: $post_body"
else
    echo "   ❌ POST 요청 실패"
    echo "   응답: $post_body"
fi

echo ""
echo "📊 테스트 결과 요약:"
if [ "$http_code" = "200" ] && [ "$post_http_code" = "200" ]; then
    echo "   🎉 모든 테스트 통과! 배포 성공!"
else
    echo "   ⚠️  일부 테스트 실패. 아래를 확인하세요:"
    echo "   - Vercel 빌드 로그에서 Next.js 14.2.18 확인"
    echo "   - 환경 변수 OPENAI_API_KEY 설정 확인"
    echo "   - Build Cache 비활성화 후 재배포"
fi

