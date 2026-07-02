import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { requireClientAccess } from '@/app/lib/authz';
import { isValidClientCode } from '@/app/lib/validators';
import { getClientVenue, setClientVenue, type VenueClientType } from '@/app/lib/clientVenue';

const asType = (v: string | null): VenueClientType => (v === 'glass' ? 'glass' : 'wine');

// GET ?client_code=&type=wine|glass → { venue }
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const code = sp.get('client_code') || '';
    if (!isValidClientCode(code)) return NextResponse.json({ error: 'Invalid client_code' }, { status: 400 });
    const type = asType(sp.get('type'));
    const access = await requireClientAccess(code, type);
    if (access) return access;
    return NextResponse.json({ venue: await getClientVenue(code, type) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}

// PUT { client_code, type, venue } — venue='' 이면 해제
export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    const body = await req.json();
    const code = String(body.client_code || '');
    if (!isValidClientCode(code)) return NextResponse.json({ error: 'Invalid client_code' }, { status: 400 });
    const type = asType(body.type);
    const access = await requireClientAccess(code, type);
    if (access) return access;
    await setClientVenue(code, type, String(body.venue || ''));
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 400 });
  }
}
