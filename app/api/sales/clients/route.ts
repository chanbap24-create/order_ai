import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { sanitizeFilterValue } from '@/app/lib/validation';
import { splitSearchWords, applyMultiWordSearch } from '@/app/lib/searchUtils';
import { getSession } from '@/app/lib/auth';
import { canViewAllManagers } from '@/app/lib/authz';

// GET: 거래처 목록 조회 (검색, 필터, 정렬)
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const importance = searchParams.get('importance');
    // manager 필터를 명시한 경우, 일반 user 는 본인으로 강제 (타 매니저 거래처 목록 열람 방지).
    // 필터 미지정 검색(원장/견적 거래처명 검색 등)은 기존대로 전체 검색 허용.
    let manager = searchParams.get('manager');
    if (manager && !canViewAllManagers(session)) manager = session.manager;
    const clientType = searchParams.get('type');
    const sortBy = searchParams.get('sort') || 'importance';
    const order = searchParams.get('order') || 'asc';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // 담당자 필터
    //  - 와인: 권한(requireClientAccess)과 동일하게 client_details.manager 로 필터(아래 wine 쿼리).
    //    인수인계 시 '현재 담당'이 목록·원장 전부 접근 = 일치. 옛 담당은 넘긴 거래처가 목록에서 빠져
    //    "목록엔 보이는데 원장 403" 불일치가 사라짐. (담당은 shipment 동기화로 최신 유지)
    //  - 글라스: 별도 마스터 담당 컬럼이 없어 glass_shipments 담당 기반(기존 유지).
    let managerClientCodes: string[] | null = null;
    if (manager && clientType === 'glass') {
      const shipmentsTable = 'glass_shipments';
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
        // 거래처정보(글라스) 업로드로 채운 담당·업종·연락처·주소 포함 → 상세 패널에 표시
        .select('client_code, client_name, created_at, manager, business_type, contact_name, address', { count: 'exact' })
        // 비활성화된 옛 코드 ((X) prefix) 는 검색 결과에서 제외
        .not('client_name', 'ilike', '(X)%');

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
          .select('client_name, client_code')
          // 옛 코드 fallback 결과에서도 (X) 거래처 제외
          .not('client_name', 'ilike', '(X)%');
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
      .select('*', { count: 'exact' })
      // 비활성화된 옛 코드 ((X) prefix) 는 검색 결과에서 제외 (calc_wine_outstanding 과 동일 정책)
      .not('client_name', 'ilike', '(X)%');

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
    // 와인 담당자 필터 = client_details.manager (권한 소스와 동일 → 인수인계 시 현재 담당이 전부 접근)
    if (manager && clientType !== 'glass') {
      query = query.eq('manager', manager);
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

// POST: 거래처 등록 또는 수정 (upsert) — 관리 권한 전용 (UI 호출처 없음, 수동/관리 용도)
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    if (!canViewAllManagers(session)) {
      return NextResponse.json({ error: '거래처 등록/수정 권한이 없습니다.' }, { status: 403 });
    }
    const body = await req.json();

    // 단일 등록/수정 — client_type 으로 테이블 라우팅.
    // CDV/DL 코드공간 독립: 글라스 편집은 glass_clients 로, 와인 client_details 를 절대 안 건드림.
    if (!Array.isArray(body)) {
      const { client_code, ...rest } = body;
      if (!client_code) {
        return NextResponse.json({ error: 'client_code is required' }, { status: 400 });
      }

      if ((rest as { client_type?: string }).client_type === 'glass') {
        // 편집은 기존 거래처 대상 → UPDATE(부분). glass_clients 지원 컬럼만 화이트리스트(오염/오류 방지).
        // client_name NOT NULL 이라 upsert 대신 update 로 제공 필드만 갱신. (신규 등록은 거래처정보 업로드로)
        const GLASS_COLS = ['client_name', 'manager', 'business_type', 'contact_name', 'contact_phone', 'contact_email', 'address', 'memo', 'importance'];
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const k of GLASS_COLS) if (k in rest) patch[k] = (rest as Record<string, unknown>)[k];
        const { data, error } = await supabase.from('glass_clients').update(patch).eq('client_code', client_code).select().maybeSingle();
        if (error) throw error;
        return NextResponse.json({ success: true, client: { ...(data || { client_code }), ...patch, client_type: 'glass' } });
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

// DELETE: 거래처 삭제 — 관리 권한 전용
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    if (!canViewAllManagers(session)) {
      return NextResponse.json({ error: '거래처 삭제 권한이 없습니다.' }, { status: 403 });
    }
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
