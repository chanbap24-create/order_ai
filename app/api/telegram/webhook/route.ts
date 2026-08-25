import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { getEnv } from '@/app/lib/env';
import { sendTelegram } from '@/app/lib/telegram';
import { logger } from '@/app/lib/logger';

// 텔레그램 봇 webhook — 직원 계정 연동 전용.
// 인증: setWebhook 시 등록한 secret_token 헤더 검증 (미들웨어 공개 예외).
// 직원이 봇에게 앱에서 발급받은 연동 코드를 보내면 chat_id 를 계정에 저장.

export async function POST(req: NextRequest) {
  const secret = getEnv('TELEGRAM_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const update = await req.json();
    const msg = update?.message;
    const chatId = msg?.chat?.id != null ? String(msg.chat.id) : null;
    const text = String(msg?.text || '').trim();
    if (!chatId || !text) return NextResponse.json({ ok: true });

    // "/start CODE" (딥링크) 또는 코드 단독 입력 모두 허용
    const code = (text.startsWith('/start') ? text.slice(6) : text).trim().toUpperCase();

    if (/^[A-Z0-9]{6}$/.test(code)) {
      const { data: user } = await supabase.from('sales_users')
        .select('manager').eq('telegram_link_code', code).maybeSingle();
      if (user) {
        await supabase.from('sales_users')
          .update({ telegram_chat_id: chatId, telegram_link_code: null })
          .eq('manager', user.manager);
        await sendTelegram(chatId, `✅ <b>${user.manager}</b>님 계정과 연동됐습니다.\n앞으로 수금 브리핑 알림을 여기로 보내드립니다.`);
        logger.info(`[Telegram] linked: ${user.manager} ↔ ${chatId}`);
        return NextResponse.json({ ok: true });
      }
      await sendTelegram(chatId, '연동 코드가 유효하지 않습니다. 세일즈 앱 → 알림 탭에서 새 코드를 발급받아 다시 보내주세요.');
      return NextResponse.json({ ok: true });
    }

    // 연동 안내 (이미 연동된 계정이면 상태 알려줌)
    const { data: linked } = await supabase.from('sales_users')
      .select('manager').eq('telegram_chat_id', chatId).maybeSingle();
    if (linked) {
      await sendTelegram(chatId, `현재 <b>${linked.manager}</b>님 계정과 연동돼 있습니다.`);
    } else {
      await sendTelegram(chatId, '세일즈 앱 → 알림 탭에서 발급받은 6자리 연동 코드를 보내주세요.');
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.warn(`[Telegram] webhook error: ${e instanceof Error ? e.message : e}`);
    return NextResponse.json({ ok: true }); // 텔레그램 재시도 방지 — 항상 200
  }
}
