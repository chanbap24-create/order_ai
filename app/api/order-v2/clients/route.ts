import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

// 거래처 검색 API (자동완성용) - tab에 따라 CDV/DL 테이블 분리
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || '';
  const tab = req.nextUrl.searchParams.get('tab') || 'CDV';

  const clientTable = tab === 'DL' ? 'glass_clients' : 'clients';
  const aliasTable = tab === 'DL' ? 'glass_client_alias' : 'client_alias';

  try {
    if (!q.trim()) {
      const { data, error } = await supabase
        .from(clientTable)
        .select('client_code, client_name')
        .order('client_name', { ascending: true })
        .limit(50);
      if (error) throw error;
      return NextResponse.json({ clients: data || [] });
    }

    const safe = q.trim().replace(/[%_,.()"\\]/g, '');
    // 공백으로 분리하여 각 단어를 모두 포함하는 거래처 검색
    const words = safe.split(/\s+/).filter(Boolean);

    // 거래처 테이블에서 검색
    let directQuery = supabase
      .from(clientTable)
      .select('client_code, client_name');
    if (words.length <= 1) {
      directQuery = directQuery.or(`client_name.ilike.%${safe}%,client_code.ilike.%${safe}%`);
    } else {
      // 여러 단어: 모든 단어가 이름에 포함되거나, 전체 문자열이 코드에 포함
      for (const w of words) {
        directQuery = directQuery.ilike('client_name', `%${w}%`);
      }
    }
    const { data: direct, error: e1 } = await directQuery
      .order('client_name', { ascending: true })
      .limit(20);
    if (e1) throw e1;

    // alias 테이블에서도 검색 (각 단어 모두 포함)
    let aliasQuery = supabase
      .from(aliasTable)
      .select('client_code, alias');
    if (words.length <= 1) {
      aliasQuery = aliasQuery.ilike('alias', `%${safe}%`);
    } else {
      for (const w of words) {
        aliasQuery = aliasQuery.ilike('alias', `%${w}%`);
      }
    }
    const { data: aliases, error: e2 } = await aliasQuery.limit(20);
    if (e2) throw e2;

    // alias로 찾은 거래처 코드의 이름 조회
    const aliasCodes = (aliases || []).map(a => a.client_code).filter(c => !direct?.some(d => d.client_code === c));
    let aliasClients: any[] = [];
    if (aliasCodes.length > 0) {
      const { data } = await supabase
        .from(clientTable)
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
