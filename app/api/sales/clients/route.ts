import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { sanitizeFilterValue } from '@/app/lib/validation';
import { splitSearchWords, applyMultiWordSearch } from '@/app/lib/searchUtils';

// GET: 거래처 목록 조회 (검색, 필터, 정렬)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const importance = searchParams.get('importance');
    const manager = searchParams.get('manager');
    const clientType = searchParams.get('type');
    const sortBy = searchParams.get('sort') || 'importance';
    const order = searchParams.get('order') || 'asc';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // 담당자 필터: shipments에서 해당 담당자의 거래처 코드를 전체 조회
    let managerClientCodes: string[] | null = null;
    if (manager) {
      const shipmentsTable = clientType === 'glass' ? 'glass_shipments' : 'shipments';
      const codesSet = new Set<string>();
      let from = 0;
      const batchSize = 1000;

      while (true) {
        const { data: mgrShipments, error: mgrErr } = await supabase
          .from(shipmentsTable)
          .select('client_code')
          .eq('manager', manager)
          .not('client_code', 'is', null)
          .range(from, from + batchSize - 1);

        if (mgrErr) throw mgrErr;
        if (!mgrShipments || mgrShipments.length === 0) break;

        for (const s of mgrShipments) {
          if (s.client_code) codesSet.add(s.client_code);
        }

        if (mgrShipments.length < batchSize) break;
        from += batchSize;
      }

      managerClientCodes = [...codesSet];

      if (managerClientCodes.length === 0) {
        return NextResponse.json({ clients: [], total: 0, page, limit });
      }
    }

    // ═══ Glass: glass_clients + glass_shipments에서 검색 (client_details에 없음) ═══
    if (clientType === 'glass') {
      let glassQuery = supabase
        .from('glass_clients')
        .select('client_code, client_name, created_at', { count: 'exact' });

      if (search) {
        const words = splitSearchWords(search);
        glassQuery = applyMultiWordSearch(glassQuery, words, 'client_name', ['client_code']);
      }
      if (managerClientCodes) {
        glassQuery = glassQuery.in('client_code', managerClientCodes);
      }

      glassQuery = glassQuery.order('client_name', { ascending: true });
      glassQuery = glassQuery.range(offset, offset + limit - 1);

      const { data: glassData, error: glassErr, count: glassCount } = await glassQuery;
      if (glassErr) throw glassErr;

      // glass_clients에 결과가 있으면 반환
      if (glassData && glassData.length > 0) {
        return NextResponse.json({
          clients: glassData.map(c => ({ ...c, client_type: 'glass' })),
          total: glassCount || 0,
          page,
          limit,
        });
      }

      // glass_clients에 없으면 glass_shipments에서 이름 검색 (client_code null인 경우)
      if (search) {
        const words = splitSearchWords(search);
        let shipQuery = supabase
          .from('glass_shipments')
          .select('client_name, client_code');
        shipQuery = applyMultiWordSearch(shipQuery, words, 'client_name', []);
        if (manager) {
          shipQuery = shipQuery.eq('manager', manager);
        }
        shipQuery = shipQuery.limit(200);

        const { data: shipData } = await shipQuery;
        // DISTINCT by client_name
        const seen = new Map<string, string>();
        for (const r of (shipData || [])) {
          if (r.client_name && !seen.has(r.client_name)) {
            seen.set(r.client_name, r.client_code || r.client_name);
          }
        }
        const results = [...seen.entries()].slice(0, limit).map(([name, code]) => ({
          client_code: code,
          client_name: name,
          client_type: 'glass',
        }));
        return NextResponse.json({
          clients: results,
          total: results.length,
          page,
          limit,
        });
      }

      return NextResponse.json({ clients: [], total: 0, page, limit });
    }

    // ═══ Wine: 기존 client_details 조회 ═══
    let query = supabase
      .from('client_details')
      .select('*', { count: 'exact' });

    // 검색
    if (search) {
      const words = splitSearchWords(search);
      query = applyMultiWordSearch(query, words, 'client_name', ['client_code', 'contact_name']);
    }

    // 필터
    if (importance) {
      query = query.eq('importance', parseInt(importance));
    }
    if (managerClientCodes) {
      query = query.in('client_code', managerClientCodes);
    }
    if (clientType) {
      query = query.eq('client_type', clientType);
    }

    // 정렬
    const ascending = order === 'asc';
    query = query.order(sortBy, { ascending });

    // 페이지네이션
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      clients: data || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (err) {
    console.error('GET /api/sales/clients error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST: 거래처 등록 또는 수정 (upsert)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 단일 등록/수정
    if (!Array.isArray(body)) {
      const { client_code, ...rest } = body;
      if (!client_code) {
        return NextResponse.json({ error: 'client_code is required' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('client_details')
        .upsert({ client_code, ...rest }, { onConflict: 'client_code' })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, client: data });
    }

    // 일괄 등록 (엑셀 업로드 등)
    const { data, error } = await supabase
      .from('client_details')
      .upsert(body, { onConflict: 'client_code' })
      .select();

    if (error) throw error;
    return NextResponse.json({ success: true, count: data?.length || 0 });
  } catch (err) {
    console.error('POST /api/sales/clients error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE: 거래처 삭제
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('client_details')
      .delete()
      .eq('client_code', code);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/sales/clients error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
