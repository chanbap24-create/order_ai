import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { supabase } from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';
import { telegramConfigured, getBotUsername } from '@/app/lib/telegram';

// 텔레그램 알림 연동 — 본인 계정의 연동 상태/코드 발급/해제.

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const { data } = await supabase.from('sales_users')
    .select('telegram_chat_id').eq('manager', session.manager).maybeSingle();
  return NextResponse.json({
    configured: telegramConfigured(),
    linked: !!data?.telegram_chat_id,
  });
}

// 코드 발급 (기존 코드 덮어씀). 봇에서 코드 입력 시 webhook 이 chat_id 저장.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  if (!telegramConfigured()) {
    return NextResponse.json({ error: '텔레그램 봇이 아직 설정되지 않았습니다.' }, { status: 400 });
  }
  // 6자리 영숫자 (혼동 문자 제외)
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const code = Array.from(randomBytes(6)).map((b) => chars[b % chars.length]).join('');
  const { error } = await supabase.from('sales_users')
    .update({ telegram_link_code: code }).eq('manager', session.manager);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const bot = await getBotUsername();
  return NextResponse.json({
    code,
    bot_username: bot,
    deep_link: bot ? `https://t.me/${bot}?start=${code}` : null,
  });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const { error } = await supabase.from('sales_users')
    .update({ telegram_chat_id: null, telegram_link_code: null }).eq('manager', session.manager);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
