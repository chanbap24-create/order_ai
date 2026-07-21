-- collection_followups.payment_type CHECK 제약에 신규 수금일 유형 추가.
-- 기존 제약은 옛 7개('prepay','eom','nm5','nm10','nm15','nm20','nme')만 허용 →
--   익월25(nm25)·익익월(nnm10/nnm15/nnme) 저장 시 제약 위반으로 실패, UI가 원래값으로 롤백(새로고침)되던 문제.
alter table collection_followups drop constraint if exists collection_followups_payment_type_check;
alter table collection_followups add constraint collection_followups_payment_type_check
  check (payment_type is null or payment_type = any (array[
    'prepay','eom','nm5','nm10','nm15','nm20','nm25','nme','nnm10','nnm15','nnme'
  ]));
