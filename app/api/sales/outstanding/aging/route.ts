import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

// GET /api/sales/outstanding/aging?manager=XXX&type=wine&as_of=YYYY-MM-DD
// 미수금 연령 분석(0-30/31-60/61-90/90+). 까브드뱅/대유라이프 별도 RPC.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const manager = searchParams.get('manager');
    const clientType = searchParams.get('type') || 'wine';
    const asOf = searchParams.get('as_of') || undefined;

    if (!manager) {
      return NextResponse.json({ error: 'manager required' }, { status: 400 });
    }

    const rpcName = clientType === 'glass' ? 'calc_glass_aging' : 'calc_wine_aging';
    const params: Record<string, string> = { p_manager: manager };
    if (asOf) params.p_as_of = asOf;

    const { data, error } = await supabase.rpc(rpcName, params);
    if (error) throw error;
    return NextResponse.json({ clients: data || [] });
  } catch (err) {
    console.error('GET /api/sales/outstanding/aging error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
