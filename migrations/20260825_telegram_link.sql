-- 텔레그램 알림 연동: 직원 계정에 chat_id + 1회용 연동 코드
alter table sales_users
  add column if not exists telegram_chat_id text,
  add column if not exists telegram_link_code text;
