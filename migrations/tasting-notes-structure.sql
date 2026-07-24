-- 와인 구조 프로파일(1~5 정수) — AI 조사 시 채움. 소믈리에 취향 매칭용.
-- body: 1=라이트 ~ 5=풀바디 / sweetness: 1=드라이 ~ 5=스위트
-- acidity: 1=낮음 ~ 5=높음 / tannin: 1=부드러움 ~ 5=강함 (화이트·스파클링은 null 허용)
alter table tasting_notes
  add column if not exists body smallint,
  add column if not exists sweetness smallint,
  add column if not exists acidity smallint,
  add column if not exists tannin smallint;
