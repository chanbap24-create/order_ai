import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { getHomeSummary } from '@/app/lib/todaySummary';

// 브리핑 '오늘' 요약 — 로그인한 세일즈 사용자만(비로그인 홈은 요약 없이 네비만 노출).
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return NextResponse.json({ summary: await getHomeSummary(session.manager) });
  } catch (e) {
    console.error('GET /api/sales/briefing/summary error:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
