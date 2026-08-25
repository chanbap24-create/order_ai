import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getEnv } from '@/app/lib/env';
import { verifyToken } from '@/app/lib/auth';
import { refreshSegmentProfiles } from '@/app/lib/segmentProfiles';

// 업장유형·지역 세그먼트 프로파일 정기 자동 갱신(일일). 새 판매가 쌓이면 트렌드가 다음날 견적에 자동 반영.
// Vercel Cron(Bearer) 또는 어드민(admin_auth) 트리거.

export const maxDuration = 300; // 12개월 shipments 전량 스캔 — 타임아웃으로 중간 실패 방지
async function authorize(req: NextRequest): Promise<boolean> {
  const secret = getEnv('CRON_SECRET');
  const auth = req.headers.get('authorization') || '';
  if (secret && auth === `Bearer ${secret}`) return true;
  // 어드민 폴백: role 확인 필수 — sales_auth 토큰(같은 서명키)으로 통과되는 권한 우회 방지
  const token = (await cookies()).get('admin_auth')?.value;
  if (!token) return false;
  const p = await verifyToken(token);
  return p?.role === 'admin';
}

async function run(req: NextRequest) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const result = await refreshSegmentProfiles();
  return NextResponse.json({ success: true, ...result });
}

export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }
