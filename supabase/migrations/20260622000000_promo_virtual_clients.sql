-- 프로모션 가상 거래처.
-- 매월 전체 프로모션을 인벤토리 견적서로 만들어 기록하기 위한 마스터 행.
-- 견적 화면의 거래처 검색에서 "프로모션"으로 검색하면 선택된다.
-- 법인 분리: CDV(와인)=client_details, DL(글라스)=glass_clients.
-- 전환은 거래처를 가리지 않고 전 거래처 출고로 집계한다(app/lib/quoteConversion.ts isPromoClient).

INSERT INTO client_details (client_code, client_name, client_type, importance)
VALUES ('PROMO-CDV', '[프로모션] 전체발송', 'wine', 5)
ON CONFLICT (client_code) DO NOTHING;

INSERT INTO glass_clients (client_code, client_name)
VALUES ('PROMO-DL', '[프로모션] 전체발송')
ON CONFLICT (client_code) DO NOTHING;
