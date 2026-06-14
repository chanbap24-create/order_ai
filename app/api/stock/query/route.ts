import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 60;

// 재고 질의어에서 군더더기 제거 ("0884/0 재고있어?" → "0884/0")
const STOCK_WORDS = /(재고|있어|있나|있니|얼마|몇\s*개|몇\s*병|몇\s*잔|남았|남아|확인|조회|얼마나|있을까|보유)\??/g;

/**
 * 자연어 재고 조회.
 * 매칭은 발주 파싱 파이프라인(/api/order-v2/parse)을 재사용해 동일한 정확도 보장
 * (모델번호·브랜드약어·퍼지·학습 별칭 전부 적용). 매칭된 품번에 풍부한 재고 정보를 붙여 반환.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawQuery: string = (body.query || '').toString();
    const tab: 'CDV' | 'DL' = body.tab === 'DL' ? 'DL' : 'CDV';
    const cleaned = rawQuery.replace(STOCK_WORDS, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned) {
      return NextResponse.json({ error: '조회할 품목을 입력하세요.' }, { status: 400 });
    }

    // 1) 발주 파싱 재사용으로 품목 매칭 (내부 호출, 세션 쿠키 전달)
    const origin = req.nextUrl.origin;
    const parseRes = await fetch(`${origin}/api/order-v2/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') || '' },
      body: JSON.stringify({ client_code: '', client_name: '', order_text: cleaned, tab }),
    });
    if (!parseRes.ok) {
      const e = await parseRes.json().catch(() => ({}));
      return NextResponse.json({ error: e.error || '매칭 실패' }, { status: parseRes.status });
    }
    const parsed = await parseRes.json();
    const lines: any[] = parsed.orderLines || [];

    // 라인별 상위 후보 품번 수집 (중복 제거, 라인당 최대 5)
    const itemNos: string[] = [];
    const seen = new Set<string>();
    for (const l of lines) {
      for (const c of (l.candidates || []).slice(0, 5)) {
        const no = (c.item_no || '').trim();
        if (no && !seen.has(no.toUpperCase())) { seen.add(no.toUpperCase()); itemNos.push(no); }
      }
    }
    if (itemNos.length === 0) {
      return NextResponse.json({ query: cleaned, tab, items: [] });
    }

    // 2) 매칭된 품번의 풍부한 재고 + 입고예정
    const table = tab === 'DL' ? 'inventory_dl' : 'inventory_cdv';
    const upper = itemNos.map((n) => n.toUpperCase());
    const todayStr = new Date().toISOString().slice(0, 10);
    const [invRes, impRes] = await Promise.all([
      supabase.from(table)
        .select('item_no, item_name, supply_price, available_stock, total_stock, pending_shipment, incoming_stock, bonded_warehouse, sales_30days, avg_sales_90d')
        .in('item_no', itemNos),
      supabase.from('import_schedule')
        .select('item_code, arrival_date, total_btls')
        .in('item_code', itemNos)
        .gte('arrival_date', todayStr),
    ]);
    if (invRes.error) throw invRes.error;

    const impMap = new Map<string, Array<{ arrival_date: string; total_btls: number }>>();
    for (const r of (impRes.data || [])) {
      const k = (r.item_code || '').toUpperCase();
      if (!impMap.has(k)) impMap.set(k, []);
      impMap.get(k)!.push({ arrival_date: r.arrival_date, total_btls: r.total_btls });
    }

    const byNo = new Map((invRes.data || []).map((w: any) => [w.item_no.toUpperCase(), w]));
    // 매칭 순서(=정확도 순) 유지
    const items = upper
      .map((u) => byNo.get(u))
      .filter(Boolean)
      .map((w: any) => ({
        ...w,
        incoming: impMap.get((w.item_no || '').toUpperCase()) || [],
      }));

    return NextResponse.json({ query: cleaned, tab, items });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || '재고 조회 오류' }, { status: 500 });
  }
}
