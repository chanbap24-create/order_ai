import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { resolveManagerScope } from '@/app/lib/authz';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  // 일반 user 는 본인 manager 로 강제 (타 매니저 거래처 매출 목록 조회 방지)
  const scope = await resolveManagerScope(sp.get('manager'));
  if (!scope.ok) return scope.res;
  const manager = scope.manager || scope.session.manager;
  const startDate = sp.get('start') || '';
  const endDate = sp.get('end') || '';
  const businessType = sp.get('business_type') || '';
  const type = sp.get('type') || 'wine';
  const isGlass = type === 'glass';
  // 글라스(DL)는 2025-08-01 전산이관 — 이관 전 출고 제외(어드민 매출분석과 동일 기준).
  const GLASS_CUTOFF = '2025-08-01';
  const effStart = isGlass && (!startDate || startDate < GLASS_CUTOFF) ? GLASS_CUTOFF : startDate;

  try {
    const table = isGlass ? 'glass_shipments' : 'shipments';
    const SEL = 'client_code, client_name, business_type, unit_price, selling_price, supply_amount, total_amount, quantity, ship_date';

    // 글라스: 현재 담당(glass_clients.manager)의 거래처 코드로 스코프.
    //   담당 재배정 시 그 거래처의 과거 매출도 현재 담당에 귀속(어드민 매출분석과 동일 정책).
    //   와인은 종전대로 shipments.manager 로 뽑고 아래에서 재배정 보정.
    const glassCodes: string[] = [];
    if (isGlass) {
      for (let off = 0; off < 200000; off += 1000) {
        const { data, error } = await supabase
          .from('glass_clients').select('client_code')
          .eq('manager', manager).range(off, off + 999);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const r of data) if (r.client_code) glassCodes.push(r.client_code);
        if (data.length < 1000) break;
      }
    }

    // 1) 기간 내 출고 데이터 조회 (Supabase 1000행 캡 → 페이지네이션으로 전체 로드)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allRows: any[] = [];
    if (isGlass) {
      // 현재 담당 거래처 코드 청크별 전체 페이지네이션(코드가 많을 수 있어 URL 길이 회피 목적 청크).
      for (let i = 0; i < glassCodes.length; i += 150) {
        const chunk = glassCodes.slice(i, i + 150);
        for (let off = 0; off < 500000; off += 1000) {
          let q = supabase.from(table).select(SEL).in('client_code', chunk);
          if (effStart) q = q.gte('ship_date', effStart);
          if (endDate) q = q.lte('ship_date', endDate);
          if (businessType) q = q.eq('business_type', businessType);
          const { data, error } = await q.order('id', { ascending: true }).range(off, off + 999);
          if (error) throw error;
          if (!data || data.length === 0) break;
          allRows.push(...data);
          if (data.length < 1000) break;
        }
      }
    } else {
      const buildQ = () => {
        let q = supabase.from(table).select(SEL).eq('manager', manager);
        if (effStart) q = q.gte('ship_date', effStart);
        if (endDate) q = q.lte('ship_date', endDate);
        if (businessType) q = q.eq('business_type', businessType);
        return q.order('id', { ascending: true });
      };
      for (let offset = 0; offset < 500000; offset += 1000) {
        const { data, error: allErr } = await buildQ().range(offset, offset + 999);
        if (allErr) throw allErr;
        if (!data || data.length === 0) break;
        allRows.push(...data);
        if (data.length < 1000) break;
      }
    }

    // JS에서 거래처별 집계
    const clientMap = new Map<string, {
      client_code: string;
      client_name: string;
      business_type: string;
      period_supply: number;
      period_total: number;
      period_qty: number;
      order_days: Set<string>;
    }>();

    for (const row of (allRows || [])) {
      const key = row.client_code || row.client_name;
      if (!clientMap.has(key)) {
        clientMap.set(key, {
          client_code: row.client_code || '',
          client_name: row.client_name || '',
          business_type: row.business_type || '',
          period_supply: 0,
          period_total: 0,
          period_qty: 0,
          order_days: new Set(),
        });
      }
      const c = clientMap.get(key)!;
      // 매출식을 어드민 매출분석(fn_client_analysis rev_n)과 통일:
      //   2025-08 이후 = supply_amount(총액) · 이전 = selling_price(판매총액, 0이면 supply_amount).
      const rev = (row.ship_date || '') >= '2025-08-01'
        ? (Number(row.supply_amount) || 0)
        : (Number(row.selling_price) || Number(row.supply_amount) || 0);
      c.period_supply += rev;
      c.period_total += (row.total_amount || 0);
      c.period_qty += (row.quantity || 0);
      if (row.ship_date) c.order_days.add(row.ship_date);
    }

    // 1.5) 재배정 반영(와인): 현재 담당(client_details.manager)이 아닌 거래처 제외.
    //   목록을 shipments.manager(옛 출고 담당)로 뽑아서, 거래처정보 업로드로 담당을 바꿔도
    //   옛 담당 목록에 잔존하던 문제 수정. (글라스는 위에서 이미 현재 담당 코드로 스코프해 불필요.)
    if (!isGlass) {
      const codes = [...clientMap.keys()].filter(k => k);
      if (codes.length > 0) {
        const cdMgr = new Map<string, string>();
        for (let i = 0; i < codes.length; i += 500) {
          const { data: cdRows } = await supabase
            .from('client_details')
            .select('client_code, manager')
            .eq('client_type', 'wine')
            .in('client_code', codes.slice(i, i + 500));
          for (const r of (cdRows || [])) cdMgr.set(r.client_code, r.manager || '');
        }
        for (const code of codes) {
          const m = cdMgr.get(code);
          if (m != null && m !== '' && m !== manager) clientMap.delete(code);
        }
      }
    }

    // 2) 각 거래처의 최종 발주일 (전체 기간 기준)
    const clientCodes = [...clientMap.keys()].filter(k => k);
    const lastOrderMap = new Map<string, string>();

    if (clientCodes.length > 0) {
      if (isGlass) {
        // 현재 담당 코드로 스코프 — 코드 청크별 최신 발주일.
        for (let i = 0; i < clientCodes.length; i += 150) {
          const chunk = clientCodes.slice(i, i + 150);
          const { data: lastRows } = await supabase
            .from(table)
            .select('client_code, client_name, ship_date')
            .in('client_code', chunk)
            .gte('ship_date', GLASS_CUTOFF)
            .order('ship_date', { ascending: false })
            .order('id', { ascending: false });
          for (const r of (lastRows || [])) {
            const key = r.client_code || r.client_name;
            if (!lastOrderMap.has(key)) lastOrderMap.set(key, r.ship_date);
          }
        }
      } else {
        // ship_date 내림차순(+id) 페이지네이션. 모든 거래처의 최신 발주일이 채워지면 조기 종료.
        for (let offset = 0; offset < 500000 && lastOrderMap.size < clientCodes.length; offset += 1000) {
          const { data: lastRows } = await supabase
            .from(table)
            .select('client_code, client_name, ship_date')
            .eq('manager', manager)
            .in('client_code', clientCodes)
            .order('ship_date', { ascending: false })
            .order('id', { ascending: false })
            .range(offset, offset + 999);
          if (!lastRows || lastRows.length === 0) break;
          for (const r of lastRows) {
            const key = r.client_code || r.client_name;
            if (!lastOrderMap.has(key)) lastOrderMap.set(key, r.ship_date);
          }
          if (lastRows.length < 1000) break;
        }
      }
    }

    // 2.5) 업장 유형 태그 부착 (미태깅 거래처 식별용)
    const venueMap = new Map<string, string>();
    if (clientCodes.length > 0) {
      const vType = isGlass ? 'glass' : 'wine';
      for (let i = 0; i < clientCodes.length; i += 500) {
        const { data: vRows } = await supabase
          .from('client_venue')
          .select('client_code, venue')
          .eq('client_type', vType)
          .in('client_code', clientCodes.slice(i, i + 500));
        for (const v of (vRows || [])) venueMap.set(v.client_code, v.venue);
      }
    }

    // 3) 결과 조합
    const clients = [...clientMap.values()].map(c => ({
      client_code: c.client_code,
      client_name: c.client_name,
      business_type: c.business_type,
      venue: venueMap.get(c.client_code) || '',
      period_supply: Math.round(c.period_supply),
      period_total: Math.round(c.period_total),
      period_qty: c.period_qty,
      order_days: c.order_days.size,
      last_order_date: lastOrderMap.get(c.client_code || c.client_name) || '',
    }));

    clients.sort((a, b) => b.period_total - a.period_total);

    // 4) 업종 목록
    let businessTypes: string[] = [];
    if (isGlass) {
      // 현재 담당 거래처들의 업종(수집분).
      businessTypes = [...new Set([...clientMap.values()].map(c => c.business_type).filter(Boolean))].sort();
    } else {
      const { data: btRows } = await supabase
        .from(table)
        .select('business_type')
        .eq('manager', manager)
        .not('business_type', 'is', null)
        .not('business_type', 'eq', '');
      businessTypes = [...new Set((btRows || []).map(r => r.business_type))].sort();
    }

    return NextResponse.json({
      clients,
      businessTypes,
      totalClients: clients.length,
      totalSupply: clients.reduce((s, c) => s + c.period_supply, 0),
      totalAmount: clients.reduce((s, c) => s + c.period_total, 0),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
