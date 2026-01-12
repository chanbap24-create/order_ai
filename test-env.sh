#!/bin/bash
echo "🔍 환경 변수 확인 중..."
echo ""

if [ -f .env ]; then
    echo "✅ .env 파일 존재"
    
    # API 키가 설정되었는지 확인 (마스킹해서 표시)
    if grep -q "OPENAI_API_KEY=sk-" .env 2>/dev/null; then
        echo "✅ OPENAI_API_KEY가 설정되어 있습니다"
        # 처음 10자와 마지막 4자만 표시
        key=$(grep "OPENAI_API_KEY=" .env | cut -d= -f2)
        masked="${key:0:10}...${key: -4}"
        echo "   키: $masked"
    else
        echo "⚠️  OPENAI_API_KEY가 아직 설정되지 않았습니다"
        echo "   .env 파일에서 'OPENAI_API_KEY=여기에_새로운_API_키를_입력하세요' 부분을 수정해주세요"
    fi
else
    echo "❌ .env 파일이 없습니다"
fi

echo ""
echo "📝 .env 파일을 직접 수정하려면:"
echo "   nano /home/user/webapp/.env"
echo "   또는"
echo "   vi /home/user/webapp/.env"
