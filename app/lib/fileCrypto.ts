import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// 서버 시크릿 + 담당자명으로 파생 키 생성 (AES-256)
const SERVER_SECRET = process.env.EXPENSE_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function deriveKey(manager: string): Buffer {
  return scryptSync(SERVER_SECRET, `expense-${manager}`, 32);
}

/** AES-256-GCM 암호화 → iv(12) + authTag(16) + ciphertext */
export function encryptFile(plainBuffer: Buffer, manager: string): Buffer {
  const key = deriveKey(manager);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

/** AES-256-GCM 복호화 */
export function decryptFile(encBuffer: Buffer, manager: string): Buffer {
  const key = deriveKey(manager);
  const iv = encBuffer.subarray(0, 12);
  const authTag = encBuffer.subarray(12, 28);
  const ciphertext = encBuffer.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
