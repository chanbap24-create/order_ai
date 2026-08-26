import { supabase } from './db';
import { sendTelegram, downloadTelegramFile, escapeHtml } from './telegram';
import { extractOrderFromImage } from './orderIntake';
import { getManagerClients } from './orderClients';
import { logger } from './logger';

// 텔레그램 봇으로 전달된 카톡 발주(텍스트/사진) → order-v2 수신함(order_intake) 저장 + 요약 회신.
// MVP: 저장·회신까지. 파싱·확정은 기존 order-v2 화면(수신함 → 파서)에서.

const ORDER_V2_URL = 'https://order-ai-one.vercel.app/order-v2';

/** 텍스트 발주 — 즉시 저장 (LLM 미사용, 빠름) */
export async function intakeTextOrder(manager: string, chatId: string, text: string): Promise<void> {
  const lines = text.split('\n').map((s) => s.trim()).filter(Boolean);
  const { error } = await supabase.from('order_intake').insert({
    manager,
    tab: 'CDV',
    client_hint: null,
    order_text: text,
    // IntakeResult 형태 유지 (client_hint 는 빈 문자열 — 수신함 onLoad 가 그대로 파서에 넣음)
    result: { found: true, order_text: text, client_hint: '' },
    status: 'pending',
  });
  if (error) {
    logger.warn(`[TelegramIntake] text insert failed: ${error.message}`);
    await sendTelegram(chatId, '⚠️ 수신함 저장에 실패했습니다. 잠시 후 다시 보내주세요.');
    return;
  }
  await sendTelegram(chatId, [
    `📥 발주 수신함에 담았습니다 (${lines.length}줄)`,
    `<code>${escapeHtml(lines.slice(0, 3).join('\n'))}${lines.length > 3 ? '\n…' : ''}</code>`,
    `<a href="${ORDER_V2_URL}">order-v2에서 파싱·확정하기</a>`,
  ].join('\n'));
}

/** 사진 발주 — 기존 iOS 단축어와 동일 파이프라인(비전 추출) 재사용 */
export async function intakePhotoOrder(manager: string, chatId: string, fileId: string): Promise<void> {
  const file = await downloadTelegramFile(fileId);
  if (!file) {
    await sendTelegram(chatId, '⚠️ 사진을 받지 못했습니다. 다시 보내주세요.');
    return;
  }
  try {
    const clients = await getManagerClients(manager, 'CDV');
    const result = await extractOrderFromImage(file.buf.toString('base64'), file.mime, clients);
    const lines = String(result.order_text || '').split('\n').map((s) => s.trim()).filter(Boolean);

    await supabase.from('order_intake').insert({
      manager,
      tab: 'CDV',
      client_hint: result.client_hint || null,
      order_text: result.order_text || null,
      result,
      status: result.found ? 'pending' : 'failed',
    });

    if (result.found) {
      await sendTelegram(chatId, [
        `📥 <b>${escapeHtml(result.client_hint || '거래처 미상')}</b> · ${lines.length}줄 인식`,
        lines.length ? `<code>${escapeHtml(lines.slice(0, 3).join('\n'))}${lines.length > 3 ? '\n…' : ''}</code>` : '',
        `<a href="${ORDER_V2_URL}">order-v2에서 파싱·확정하기</a>`,
      ].filter(Boolean).join('\n'));
    } else {
      await sendTelegram(chatId, '사진에서 발주 내용을 인식하지 못했습니다. 텍스트로 보내시면 더 정확합니다.');
    }
  } catch (e) {
    logger.warn(`[TelegramIntake] photo failed: ${e instanceof Error ? e.message : e}`);
    await sendTelegram(chatId, '⚠️ 사진 분석에 실패했습니다. 텍스트로 보내주세요.');
  }
}
