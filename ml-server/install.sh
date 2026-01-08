#!/bin/bash

# PyTorch ML 서버 설치 및 실행 스크립트

echo "======================================"
echo "🚀 Order AI ML Server 설치"
echo "======================================"

cd "$(dirname "$0")"

# Python 버전 확인
echo "📌 Python 버전 확인..."
python3 --version

# 가상 환경 생성
if [ ! -d "venv" ]; then
    echo "📦 Python 가상 환경 생성..."
    python3 -m venv venv
fi

# 가상 환경 활성화
echo "✅ 가상 환경 활성화..."
source venv/bin/activate

# 패키지 설치
echo "📥 PyTorch 및 패키지 설치 중..."
pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "======================================"
echo "✅ 설치 완료!"
echo "======================================"
echo ""
echo "🎯 다음 단계:"
echo "1. English 시트 데이터 로드:"
echo "   python load_data.py"
echo ""
echo "2. ML 서버 실행:"
echo "   python main.py"
echo ""
echo "3. 또는 pm2로 백그라운드 실행:"
echo "   pm2 start ecosystem.config.js"
echo ""
