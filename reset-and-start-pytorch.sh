#!/bin/bash
set -e

echo "🧹 Step 1: 기존 학습 데이터 초기화..."
sqlite3 data.sqlite3 << SQL
DELETE FROM token_mapping;
DELETE FROM ml_training_data;
DELETE FROM token_frequency;
DELETE FROM item_alias;
SQL

echo "✅ 데이터 초기화 완료!"
echo ""

echo "📊 Step 2: 테이블 상태 확인..."
sqlite3 data.sqlite3 << SQL
SELECT 'token_mapping' as table_name, COUNT(*) as count FROM token_mapping
UNION ALL
SELECT 'ml_training_data', COUNT(*) FROM ml_training_data
UNION ALL
SELECT 'token_frequency', COUNT(*) FROM token_frequency
UNION ALL
SELECT 'item_alias', COUNT(*) FROM item_alias;
SQL

echo ""
echo "🎯 완료! PyTorch 설치를 시작합니다..."
