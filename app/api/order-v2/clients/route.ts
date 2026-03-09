import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

// 거래처 검색 API (자동완성용)
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || '';

  try {
    if (!q.trim()) {
      // 빈 검색어면 최근 거래처 50개
      const { data, error } = await supabase
        .from('clients')
        .select('client_code, client_name')
        .order('client_name', { ascending: true })
        .limit(50);
      if (error) throw error;
      return NextResponse.json({ clients: data || [] });
    }

    const safe = q.trim().replace(/[%_]/g, '');

    // clients 테이블에서 검색
    const { data: direct, error: e1 } = await supabase
      .from('clients')
      .select('client_code, client_name')
      .or(`client_name.ilike.%${safe}%,client_code.ilike.%${safe}%`)
      .order('client_name', { ascending: true })
      .limit(20);
    if (e1) throw e1;

    // client_alias 테이블에서도 검색
    const { data: aliases, error: e2 } = await supabase
      .from('client_alias')
      .select('client_code, alias')
      .ilike('alias', `%${safe}%`)
      .limit(20);
    if (e2) throw e2;

    // alias로 찾은 거래처 코드의 이름 조회
    const aliasCodes = (aliases || []).map(a => a.client_code).filter(c => !direct?.some(d => d.client_code === c));
    let aliasClients: any[] = [];
    if (aliasCodes.length > 0) {
      const { data } = await supabase
        .from('clients')
        .select('client_code, client_name')
        .in('client_code', aliasCodes);
      aliasClients = data || [];
    }

    // 합치고 중복 제거
    const map = new Map<string, { client_code: string; client_name: string }>();
    for (const c of [...(direct || []), ...aliasClients]) {
      if (!map.has(c.client_code)) map.set(c.client_code, c);
    }

    return NextResponse.json({ clients: [...map.values()] });
  } catch (error: any) {
    return NextResponse.json({ clients: [], error: error.message }, { status: 500 });
  }
}
