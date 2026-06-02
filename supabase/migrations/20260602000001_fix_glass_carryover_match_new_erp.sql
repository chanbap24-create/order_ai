-- 신전산(2025-08) 이관 이월 미수금 정본에 맞춰 glass_client_carryover 보정.
-- 정본 = 신전산 거래처원장(2025-08~) 의 '이월' 행 P열(미수금).
-- 537개 코드 중 533개는 이미 일치, 아래 4개만 DB가 틀어져 있어 보정.
-- 보정 후 DB 이월 합계 = 10,769,115,252 (정본과 diff 0).
UPDATE glass_client_carryover SET carryover_amount = 0      WHERE client_code = '27583'; -- 롯데칠성음료(주): -8,200,170 → 0
UPDATE glass_client_carryover SET carryover_amount = 274500 WHERE client_code = '27025'; -- (주)지에스리테일: 531,000 → 274,500
UPDATE glass_client_carryover SET carryover_amount = 0      WHERE client_code = '32330'; -- 정본에 없음: 689,040 → 0
UPDATE glass_client_carryover SET carryover_amount = 0      WHERE client_code = '31187'; -- 정본에 없음: -166,320 → 0
