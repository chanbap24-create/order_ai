import { NextResponse } from 'next/server';
import { isValidClientCode } from '@/app/lib/validators';
import { requireClientAccess } from '@/app/lib/authz';
import { buildLlmQuote } from '../lib/llmQuote';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { client_code, count } = await req.json();
    if (!client_code || !isValidClientCode(client_code)) {
      return NextResponse.json({ error: 'Invalid client_code' }, { status: 400 });
    }
    const accessCheck = await requireClientAccess(client_code);
    if (accessCheck) return accessCheck;

    const pick = Math.min(15, Math.max(3, Number(count) || 10));
    const result = await buildLlmQuote(client_code, pick);
    return NextResponse.json(result);
  } catch (error) {
    console.error('llm-quote API error:', error);
    return NextResponse.json({ error: '추천 견적 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
