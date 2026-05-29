import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

// POST: clients + glass_clients → client_details 동기화
// 기존 거래처 데이터를 영업 관리용 테이블로 병합
export async function POST() {
  try {
    // 1. 기존 wine 거래처
    const { data: wineClients, error: e1 } = await supabase
      .from('clients')
      .select('client_code, client_name');
    if (e1) throw e1;

    // 2. 기존 glass 거래처
    const { data: glassClients, error: e2 } = await supabase
      .from('glass_clients')
      .select('client_code, client_name');
    if (e2) throw e2;

    // 3. 이미 등록된 거래처 코드 조회
    const { data: existing, error: e3 } = await supabase
      .from('client_details')
      .select('client_code');
    if (e3) throw e3;

    const existingCodes = new Set((existing || []).map(e => e.client_code));

    // 4. 새로운 거래처만 추가
    const newEntries: { client_code: string; client_name: string; client_type: string }[] = [];

    for (const c of (wineClients || [])) {
      if (!existingCodes.has(c.client_code)) {
        newEntries.push({
          client_code: c.client_code,
          client_name: c.client_name,
          client_type: 'wine',
        });
        existingCodes.add(c.client_code);
      }
    }

    for (const c of (glassClients || [])) {
      if (!existingCodes.has(c.client_code)) {
        newEntries.push({
          client_code: c.client_code,
          client_name: c.client_name,
          client_type: 'glass',
        });
        existingCodes.add(c.client_code);
      }
    }

    let inserted = 0;
    if (newEntries.length > 0) {
      // Supabase 1000개 제한이 있으므로 배치 처리
      const batchSize = 500;
      for (let i = 0; i < newEntries.length; i += batchSize) {
        const batch = newEntries.slice(i, i + batchSize);
        const { error } = await supabase
          .from('client_details')
          .upsert(batch, { onConflict: 'client_code' });
        if (error) throw error;
        inserted += batch.length;
      }
    }

    // 5. shipments(와인) 에서 담당자(manager) + 업종(business_type) 동기화
    // client_details 는 까브드뱅(CDV·와인) 코드 공간이므로 와인 출고에서만 동기화한다.
    // 대유라이프(DL·글라스)는 거래처 코드 체계가 독립이라(같은 코드가 다른 회사)
    // glass_shipments 를 섞으면 엉뚱한 법인 담당자로 덮어쓰는 코드 충돌이 발생.
    const batchSize2 = 1000;
    const clientInfo = new Map<string, { manager: string; business_type: string }>();

    async function collectFrom(table: string) {
      const out: Array<{ client_code: string; manager: string; business_type: string }> = [];
      let from = 0;
      while (true) {
        const { data: rows, error: shipErr } = await supabase
          .from(table)
          .select('client_code, manager, business_type, ship_date')
          .not('client_code', 'is', null)
          .order('ship_date', { ascending: false })
          .range(from, from + batchSize2 - 1);

        if (shipErr) break;
        if (!rows || rows.length === 0) break;

        for (const s of rows) {
          if (!s.client_code) continue;
          out.push({
            client_code: s.client_code,
            manager: s.manager || '',
            business_type: s.business_type || '',
          });
        }

        if (rows.length < batchSize2) break;
        from += batchSize2;
      }
      return out;
    }

    const wineRows = await collectFrom('shipments');
    // ship_date 내림차순이 이미 적용되어 있으므로 먼저 만난 항목을 유지 (첫 항목 우선)
    for (const s of wineRows) {
      if (!clientInfo.has(s.client_code)) {
        clientInfo.set(s.client_code, { manager: s.manager, business_type: s.business_type });
      }
    }

    // 배치 업데이트 (담당자 + 업종) — 동일 값 그룹별 bulk update
    let bizUpdated = 0;

    // (manager, business_type) 조합별로 client_code 그룹핑
    const groupMap = new Map<string, string[]>(); // key: "manager|business_type" → codes[]
    for (const [code, info] of clientInfo) {
      if (!info.manager && !info.business_type) continue;
      const key = `${info.manager || ''}|${info.business_type || ''}`;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(code);
      if (info.business_type) bizUpdated++;
    }

    // 각 그룹마다 단일 UPDATE (동일 manager+business_type 를 공유하는 코드들을 .in() 일괄)
    // 그룹 × chunk 단위 update 를 모두 병렬 실행 (기존: 순차 await)
    const updatePromises: Promise<unknown>[] = [];
    for (const [key, codes] of groupMap) {
      const [manager, business_type] = key.split('|');
      const updates: Record<string, string> = {};
      if (manager) updates.manager = manager;
      if (business_type) updates.business_type = business_type;

      for (let j = 0; j < codes.length; j += 200) {
        const chunk = codes.slice(j, j + 200);
        updatePromises.push(
          supabase.from('client_details').update(updates).eq('client_type', 'wine').in('client_code', chunk),
        );
      }
    }
    await Promise.all(updatePromises);

    // 보정: 가장 최근 1건의 manager 만으로 덮어쓰면 잘못된 매니저가 들어갈 수 있음
    // → fn_sync_client_managers 로 최근 12개월 dominant manager + 퇴사자 제외 일괄 정정
    let managerSynced = 0;
    try {
      const { data: synced, error: syncErr } = await supabase.rpc('fn_sync_client_managers');
      if (!syncErr && Array.isArray(synced)) managerSynced = synced.length;
    } catch { /* non-fatal */ }

    return NextResponse.json({
      success: true,
      inserted,
      bizUpdated,
      managerSynced,
      total_wine: wineClients?.length || 0,
      total_glass: glassClients?.length || 0,
    });
  } catch (err) {
    console.error('POST /api/sales/clients/sync error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
