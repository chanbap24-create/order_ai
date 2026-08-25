import { getEnv } from './env';
import { logger } from './logger';

// 텔레그램 봇 발송 (직원 내부 알림용). 미설정 시 no-op.
// 봇 생성(BotFather) 후 TELEGRAM_BOT_TOKEN / TELEGRAM_WEBHOOK_SECRET 환경변수 설정.

const API = (token: string) => `https://api.telegram.org/bot${token}`;

export function telegramConfigured(): boolean {
  return !!getEnv('TELEGRAM_BOT_TOKEN');
}

/** HTML parse_mode 발송. 실패해도 throw 하지 않고 결과만 반환. */
export async function sendTelegram(chatId: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const token = getEnv('TELEGRAM_BOT_TOKEN');
  if (!token) return { ok: false, error: 'TELEGRAM_BOT_TOKEN 미설정' };
  try {
    const res = await fetch(`${API(token)}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: html,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      const err = data?.description || `HTTP ${res.status}`;
      logger.warn(`[Telegram] send failed to ${chatId}: ${err}`);
      return { ok: false, error: err };
    }
    return { ok: true };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    logger.warn(`[Telegram] send error: ${err}`);
    return { ok: false, error: err };
  }
}

/** 봇 username 조회 (연동 딥링크 t.me/<username>?start=<code> 용) */
export async function getBotUsername(): Promise<string | null> {
  const token = getEnv('TELEGRAM_BOT_TOKEN');
  if (!token) return null;
  try {
    const res = await fetch(`${API(token)}/getMe`);
    const data = await res.json();
    return data?.result?.username || null;
  } catch {
    return null;
  }
}

/** HTML 이스케이프 (거래처명 등 데이터 삽입 시) */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
