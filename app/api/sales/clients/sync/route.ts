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

    // 5. shipments에서 담당자(manager) + 업종(business_type) 동기화
    // Wine: shipments에서 최근 담당자 & 업종
    const batchSize2 = 1000;
    const clientInfo = new Map<string, { manager: string; business_type: string }>();

    for (const table of ['shipments', 'glass_shipments']) {
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
          if (!clientInfo.has(s.client_code)) {
            clientInfo.set(s.client_code, {
              manager: s.manager || '',
              business_type: s.business_type || '',
            });
          }
        }

        if (rows.length < batchSize2) break;
        from += batchSize2;
      }
    }

    // 배치 업데이트 (담당자 + 업종)
    let bizUpdated = 0;
    for (const [code, info] of clientInfo) {
      const updates: Record<string, string> = {};
      if (info.manager) updates.manager = info.manager;
      if (info.business_type) updates.business_type = info.business_type;
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('client_details')
          .update(updates)
          .eq('client_code', code);
        if (!error && info.business_type) bizUpdated++;
      }
    }

    return NextResponse.json({
      success: true,
      inserted,
      bizUpdated,
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
