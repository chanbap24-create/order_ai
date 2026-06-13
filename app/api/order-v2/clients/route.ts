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

    // 3개 쿼리 병렬 실행 (순차→병렬 최적화)
    let directQuery = supabase.from(clientTable).select('client_code, client_name');
    directQuery = applyMultiWordSearch(directQuery, words, 'client_name', ['client_code']);

    let aliasQuery = supabase.from(aliasTable).select('client_code, alias');
    aliasQuery = applyMultiWordSearch(aliasQuery, words, 'alias', []);

    const shipTable = tab === 'DL' ? 'glass_shipments' : 'shipments';
    let shipQuery = supabase.from(shipTable).select('client_code, client_name');
    shipQuery = applyMultiWordSearch(shipQuery, words, 'client_name', []);

    const [directRes, aliasRes, shipRes] = await Promise.all([
      directQuery.order('client_name', { ascending: true }).limit(20),
      aliasQuery.limit(20),
      shipQuery.limit(50),
    ]);

    if (directRes.error) throw directRes.error;
    if (aliasRes.error) throw aliasRes.error;
    const direct = directRes.data;
    const aliases = aliasRes.data;
    const shipData = shipRes.data;

    // alias → code → name 매핑 (alias명 보존)
    const aliasMap = new Map<string, string>(); // code → alias
    for (const a of (aliases || [])) {
      if (!aliasMap.has(a.client_code)) aliasMap.set(a.client_code, a.alias);
    }
    const aliasCodes = [...aliasMap.keys()].filter(c => !direct?.some(d => d.client_code === c));
    let aliasClients: any[] = [];
    if (aliasCodes.length > 0) {
      const { data } = await supabase
        .from(clientTable)
        .select('client_code, client_name')
        .in('client_code', aliasCodes);
      aliasClients = (data || []).map(c => ({
        ...c,
        matched_alias: aliasMap.get(c.client_code) || null,
      }));
    }

    // 합치고 중복 제거
    const map = new Map<string, { client_code: string; client_name: string; matched_alias?: string; sim?: number }>();
    for (const c of [...(direct || []), ...aliasClients]) {
      if (!map.has(c.client_code)) map.set(c.client_code, c);
    }
    // shipments에서 발견된 거래처 추가 (client_name 기준 중복 제거)
    const seenNames = new Set([...map.values()].map(c => c.client_name));
    for (const r of (shipData || [])) {
      if (r.client_name && !seenNames.has(r.client_name)) {
        const key = r.client_code || `ship_${r.client_name}`;
        if (!map.has(key)) {
          map.set(key, { client_code: r.client_code || r.client_name, client_name: r.client_name });
          seenNames.add(r.client_name);
        }
      }
    }

    // 정확/부분 검색 결과가 적으면 트라이그램 퍼지로 보강 (오타·띄어쓰기 흡수)
    if (map.size < 8 && q.trim().length >= 2) {
      const { data: fz } = await supabase.rpc('fuzzy_clients', {
        p_q: q.trim(), p_glass: tab === 'DL', p_limit: 8,
      });
      for (const f of (fz || []) as { client_code: string; client_name: string; sim: number }[]) {
        if (f.client_code && !map.has(f.client_code)) {
          map.set(f.client_code, { client_code: f.client_code, client_name: f.client_name, sim: f.sim });
        }
      }
    }

    return NextResponse.json({ clients: [...map.values()] });
  } catch (error: any) {
    return NextResponse.json({ clients: [], error: error.message }, { status: 500 });
  }
}
