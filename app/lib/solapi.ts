import crypto from 'crypto';
import { getEnv } from './env';
import { logger } from './logger';

// Solapi 카카오 알림톡(ATA) 발송. 미설정 시 no-op.
// 자격증명/템플릿/발신프로필/발신번호는 Solapi·카카오 콘솔에서 사전 등록 필요.

const SEND_URL = 'https://api.solapi.com/messages/v4/send';

export function solapiConfigured(): boolean {
  return !!(getEnv('SOLAPI_API_KEY') && getEnv('SOLAPI_API_SECRET')
    && getEnv('SOLAPI_PFID') && getEnv('SOLAPI_TEMPLATE_ID') && getEnv('SOLAPI_SENDER'));
}

function authHeader(apiKey: string, apiSecret: string): string {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(32).toString('hex');
  const signature = crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex');
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

export interface AlimtalkParams {
  /** 수신 전화번호 (하이픈 무관) */
  to: string;
  /** 템플릿 변수 맵. 키는 등록 템플릿의 변수명(예 '#{이름}') */
  variables: Record<string, string>;
  /** 알림톡 실패 시 SMS 대체 문구 */
  fallbackText?: string;
}

export async function sendAlimtalk({ to, variables, fallbackText }: AlimtalkParams): Promise<{ ok: boolean; error?: string }> {
  const apiKey = getEnv('SOLAPI_API_KEY');
  const apiSecret = getEnv('SOLAPI_API_SECRET');
  const pfId = getEnv('SOLAPI_PFID');
  const templateId = getEnv('SOLAPI_TEMPLATE_ID');
  const from = getEnv('SOLAPI_SENDER');
  if (!apiKey || !apiSecret || !pfId || !templateId || !from) return { ok: false, error: 'Solapi 미설정' };

  const toDigits = to.replace(/[^0-9]/g, '');
  if (!toDigits) return { ok: false, error: '수신번호 없음' };

  try {
    const res = await fetch(SEND_URL, {
      method: 'POST',
      headers: { Authorization: authHeader(apiKey, apiSecret), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          to: toDigits,
          from: from.replace(/[^0-9]/g, ''),
          type: 'ATA',                                  // 알림톡
          kakaoOptions: { pfId, templateId, variables, disableSms: false },
          text: fallbackText || '',                     // SMS 대체 본문
        },
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.errorCode || j.statusCode >= '300') {
      logger.error('[solapi] 알림톡 발송 실패', { status: res.status, body: j });
      return { ok: false, error: j.errorMessage || j.statusMessage || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    logger.error('[solapi] 알림톡 발송 예외', { error: e });
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}
