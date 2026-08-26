import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { supabase } from '@/app/lib/db';
import { getEnv } from '@/app/lib/env';
import { sendTelegram } from '@/app/lib/telegram';
import { intakeTextOrder, intakePhotoOrder, handleClientCallback, tryAssignByReply } from '@/app/lib/telegramIntake';
import { logger } from '@/app/lib/logger';

// 텔레그램 봇 webhook — 직원 계정 연동 + 카톡 발주 전달(수신함).
// 인증: setWebhook 시 등록한 secret_token 헤더 검증 (미들웨어 공개 예외).
// ① 연동 코드(6자리) → chat_id 저장  ② 연동자의 텍스트/사진 → order-v2 수신함 + 요약 회신.

export const maxDuration = 60; // 사진 발주 비전 추출 대기

export async function POST(req: NextRequest) {
  const secret = getEnv('TELEGRAM_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const update = await req.json();

    // ── 인라인 버튼 콜백 (거래처 확정) ──
    const cb = update?.callback_query;
    if (cb?.id) {
      const cbChatId = cb.message?.chat?.id != null ? String(cb.message.chat.id) : null;
      if (cbChatId) {
        const { data: cbUser } = await supabase.from('sales_users')
          .select('manager').eq('telegram_chat_id', cbChatId).maybeSingle();
        if (cbUser) await handleClientCallback(cbUser.manager, cbChatId, String(cb.id), String(cb.data || ''));
      }
      return NextResponse.json({ ok: true });
    }

    const msg = update?.message;
    const chatId = msg?.chat?.id != null ? String(msg.chat.id) : null;
    const text = String(msg?.text || msg?.caption || '').trim();
    const photos = Array.isArray(msg?.photo) ? msg.photo : [];
    if (!chatId || (!text && photos.length === 0)) return NextResponse.json({ ok: true });

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

    // 연동 계정 확인
    const { data: linked } = await supabase.from('sales_users')
      .select('manager').eq('telegram_chat_id', chatId).maybeSingle();
    if (!linked) {
      await sendTelegram(chatId, '세일즈 앱 → 알림 탭에서 발급받은 6자리 연동 코드를 보내주세요.');
      return NextResponse.json({ ok: true });
    }

    // ── 발주 전달 (연동자 전용) ──
    // 사진: 기존 비전 추출 파이프라인 재사용. 응답은 즉시 200(텔레그램 재시도 방지), 처리는 after 로.
    if (photos.length > 0) {
      const largest = photos[photos.length - 1]; // 텔레그램은 해상도 오름차순
      after(intakePhotoOrder(linked.manager, chatId, String(largest.file_id)));
      return NextResponse.json({ ok: true });
    }
    // 텍스트: 10자 이상이면 발주문으로 간주해 수신함 저장 (봇 사용자는 직원뿐 — 오탐 비용 낮음)
    if (text.length >= 10) {
      await intakeTextOrder(linked.manager, chatId, text);
      return NextResponse.json({ ok: true });
    }
    // 짧은 텍스트: 직전 미지정 발주가 있으면 '거래처명 답장'으로 해석
    if (await tryAssignByReply(linked.manager, chatId, text)) {
      return NextResponse.json({ ok: true });
    }
    await sendTelegram(chatId, [
      `현재 <b>${linked.manager}</b>님 계정과 연동돼 있습니다.`,
      '카톡 발주문을 전달(공유)하면 order-v2 수신함에 담아드립니다. (텍스트/사진 모두 가능)',
    ].join('\n'));
    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.warn(`[Telegram] webhook error: ${e instanceof Error ? e.message : e}`);
    return NextResponse.json({ ok: true }); // 텔레그램 재시도 방지 — 항상 200
  }
}
