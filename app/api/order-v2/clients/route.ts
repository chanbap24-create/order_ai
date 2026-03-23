import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { splitSearchWords, applyMultiWordSearch } from '@/app/lib/searchUtils';

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

    const words = splitSearchWords(q);

    // 거래처 테이블에서 검색
    let directQuery = supabase
      .from(clientTable)
      .select('client_code, client_name');
    directQuery = applyMultiWordSearch(directQuery, words, 'client_name', ['client_code']);
    const { data: direct, error: e1 } = await directQuery
      .order('client_name', { ascending: true })
      .limit(20);
    if (e1) throw e1;

    // alias 테이블에서도 검색
    let aliasQuery = supabase
      .from(aliasTable)
      .select('client_code, alias');
    aliasQuery = applyMultiWordSearch(aliasQuery, words, 'alias', []);
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

    // glass_clients/alias에 없으면 shipments 테이블에서 fallback 검색
    if (map.size === 0) {
      const shipTable = tab === 'DL' ? 'glass_shipments' : 'shipments';
      let shipQuery = supabase
        .from(shipTable)
        .select('client_code, client_name');
      shipQuery = applyMultiWordSearch(shipQuery, words, 'client_name', ['client_code']);
      const { data: shipData } = await shipQuery.limit(200);

      // DISTINCT by client_name
      const seen = new Map<string, string>();
      for (const r of (shipData || [])) {
        if (r.client_name && !seen.has(r.client_name)) {
          seen.set(r.client_name, r.client_code || r.client_name);
        }
      }
      for (const [name, code] of seen) {
        if (!map.has(code)) map.set(code, { client_code: code, client_name: name });
      }
    }

    return NextResponse.json({ clients: [...map.values()] });
  } catch (error: any) {
    return NextResponse.json({ clients: [], error: error.message }, { status: 500 });
  }
}
