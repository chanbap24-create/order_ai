import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import {
  listPromotions, createPromotion, updatePromotion, deletePromotion, enrichWithStock,
} from '@/app/lib/promotions';

// 세일즈 프로모션 관리 — 인증된 세일즈 사용자만.
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    const corp = req.nextUrl.searchParams.get('corporation') || 'CDV';
    return NextResponse.json({ promotions: await enrichWithStock(await listPromotions(corp)) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    const body = await req.json();
    const promo = await createPromotion(body);
    return NextResponse.json({ success: true, promotion: promo });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    const body = await req.json();
    const { id, ...patch } = body;
    const promo = await updatePromotion(String(id || ''), patch);
    return NextResponse.json({ success: true, promotion: promo });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    const id = req.nextUrl.searchParams.get('id') || '';
    await deletePromotion(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 400 });
  }
}
