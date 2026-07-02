-- 거래처 업장 유형(요리/성격) 태그. 세일즈에서 수동 선택. 추천 프로파일 근거로 사용.
-- (client_code, client_type) 단위. client_type: 'wine'(CDV) | 'glass'(DL) — 코드 네임스페이스 분리.
create table if not exists client_venue (
  client_code text not null,
  client_type text not null default 'wine',
  venue text not null,
  updated_at timestamptz not null default now(),
  primary key (client_code, client_type)
);
