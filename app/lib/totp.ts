/**
 * TOTP (RFC 6238) 헬퍼.
 * otplib 13.x 의 functional API 사용 (기존 authenticator 객체는 제거됨).
 *
 *  - generateSecret: 새 TOTP 시크릿 생성 (setup 시 1회)
 *  - buildOtpAuthUrl: QR 코드에 인코딩할 otpauth:// URL
 *  - generateQrDataUrl: QR 코드 data URL (PNG)
 *  - verifyToken: 6자리 코드 검증 (±1 step = 30초 오차 허용)
 *  - generateBackupCodes / hashBackupCode: 복구 코드 10개 + 해시
 */

import { generateSecret as otpGenerateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import { createHash, randomBytes } from 'crypto';

const ISSUER = 'Cave De Vin Admin';
const PERIOD = 30;
const DIGITS = 6;
const ALGORITHM = 'sha1' as const;

export function generateSecret(): string {
  return otpGenerateSecret({ length: 20 });
}

export function buildOtpAuthUrl(accountName: string, secret: string): string {
  return generateURI({
    strategy: 'totp',
    issuer: ISSUER,
    label: accountName,
    secret,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
  });
}

export async function generateQrDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, { margin: 1, width: 256 });
}

/**
 * TOTP 6자리 코드 검증. ±1 period(30초) 허용.
 */
export function verifyToken(secret: string, token: string): boolean {
  if (!secret || !token) return false;
  const clean = token.replace(/\D/g, '').slice(0, 6);
  if (clean.length !== 6) return false;
  try {
    // verifySync: true = 현재 step만. epochTolerance = ±30초 추가 허용
    const now = Math.floor(Date.now() / 1000);
    for (const offset of [-PERIOD, 0, PERIOD]) {
      const ok = verifySync({
        strategy: 'totp',
        secret,
        token: clean,
        algorithm: ALGORITHM,
        digits: DIGITS,
        period: PERIOD,
        epoch: now + offset,
      });
      if (ok?.ok === true || (typeof ok === 'boolean' && ok)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 복구 코드 10개 생성. 각 8자리 hex (e.g. "a3f2b7c1").
 * 반환값: { plain: 화면에 표시할 원본, hashed: DB 저장할 SHA-256 해시 }
 */
export function generateBackupCodes(count = 10): { plain: string[]; hashed: string[] } {
  const plain: string[] = [];
  const hashed: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = randomBytes(4).toString('hex');
    plain.push(code);
    hashed.push(hashBackupCode(code));
  }
  return { plain, hashed };
}

export function hashBackupCode(code: string): string {
  return createHash('sha256').update(code.trim().toLowerCase()).digest('hex');
}

export function verifyBackupCode(
  code: string,
  storedHashes: string[],
): { valid: boolean; matchedHash?: string } {
  const h = hashBackupCode(code);
  const matched = storedHashes.includes(h);
  return { valid: matched, matchedHash: matched ? h : undefined };
}
