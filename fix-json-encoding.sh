#!/bin/bash

# 한글 인코딩 수정 스크립트
# 모든 API 라우트에서 NextResponse.json()을 jsonResponse()로 교체

FILES=(
  "app/api/learn-client/route.ts"
  "app/api/parse-glass-order/route.ts"
  "app/api/parse-order-v2/route.ts"
  "app/api/resolve-client/route.ts"
  "app/api/list-item-alias/route.ts"
  "app/api/learn-item-alias/route.ts"
  "app/api/confirm-item-alias/route.ts"
  "app/api/delete-item-alias/route.ts"
  "app/api/learn-new-item/route.ts"
  "app/api/sync-item-english/route.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "🔧 Processing: $file"
    
    # CRLF to LF
    sed -i 's/\r$//' "$file"
    
    # import 추가 (이미 있으면 무시)
    if ! grep -q "import { jsonResponse }" "$file"; then
      # NextResponse import 다음 줄에 추가
      sed -i '/^import.*NextResponse/a import { jsonResponse } from "@/app/lib/api-response";' "$file"
    fi
    
    # NextResponse.json() -> jsonResponse()
    sed -i 's/NextResponse\.json(/jsonResponse(/g' "$file"
    
    echo "✅ Completed: $file"
  else
    echo "⚠️  Not found: $file"
  fi
done

echo ""
echo "🎉 모든 API 한글 인코딩 수정 완료!"
