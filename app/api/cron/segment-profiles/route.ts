import { NextRequest, NextResponse } from 'next/server';
import { authorizeCron } from '@/app/lib/cronAuth';
import { refreshSegmentProfiles } from '@/app/lib/segmentProfiles';

// 업장유형·지역 세그먼트 프로파일 정기 자동 갱신(일일). 새 판매가 쌓이면 트렌드가 다음날 견적에 자동 반영.
// Vercel Cron(Bearer) 또는 어드민(admin_auth) 트리거.

export const maxDuration = 300; // 12개월 shipments 전량 스캔 — 타임아웃으로 중간 실패 방지

async function run(req: NextRequest) {
  if (!(await authorizeCron(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const result = await refreshSegmentProfiles();
  return NextResponse.json({ success: true, ...result });
}

export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }
