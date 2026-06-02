-- 와인 거래처 담당자 오배정 정정 (미수금표에 다른 담당 거래처가 끼는 문제).
-- 원인: client_details.manager 가 실제 출고 담당과 다르게 저장됨.
-- 대상: 배정 담당이 한 번도 출고 안 했는데 다른 담당이 전담한 3건 → 실제 담당으로 정정.
UPDATE client_details SET manager = '박경아' WHERE client_code = '28867' AND client_type = 'wine' AND manager = '성창우'; -- 뱅드부티크 롯데백화점본점
UPDATE client_details SET manager = '편지은' WHERE client_code = '31987' AND client_type = 'wine' AND manager = '김기범'; -- 엘리스와인
UPDATE client_details SET manager = '백근철' WHERE client_code = '29901' AND client_type = 'wine' AND manager = '김효직'; -- X(주)지에스리테일 평택물류센터
