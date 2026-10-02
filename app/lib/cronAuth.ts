// 크론 라우트 공용 인가 — Vercel Cron(Bearer CRON_SECRET) 또는 어드민(admin_auth, role=admin)만.
import { cookies } from 'next/headers';
import { getEnv } from './env';
import { verifyToken } from './auth';

export async function authorizeCron(req: Request): Promise<boolean> {
  const secret = getEnv('CRON_SECRET');
  const auth = req.headers.get('authorization') || '';
  if (secret && auth === `Bearer ${secret}`) return true;
  // 어드민 폴백: role 확인 필수 — sales_auth 토큰(같은 서명키)으로 통과되는 권한 우회 방지
  const token = (await cookies()).get('admin_auth')?.value;
  if (!token) return false;
  return verifyToken(token)?.role === 'admin';
}
