import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const type = sp.get('type') || 'wine'; // 'wine' (CDV) | 'glass' (DL)

  // ── 필터 목록 ──
  if (sp.get('filters') === '1') {
    const { data, error } = await supabase.rpc('fn_shipment_filters', { p_type: type });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({
      success: true,
      managers: data?.managers ?? [],
      departments: data?.departments ?? [],
      dateRange: data?.dateRange ?? null,
    });
  }

  // ── 거래처 자동완성 ──
  const suggest = sp.get('suggest');
  if (suggest) {
    const { data, error } = await supabase.rpc('fn_client_suggestions', { p_query: suggest, p_type: type });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, clients: data ?? [] });
  }

  // ── 분석 데이터 ──
  const manager = sp.get('manager') || '';
  const department = sp.get('department') || '';
  const client = sp.get('client') || '';
  const startDate = sp.get('startDate') || '';
  const endDate = sp.get('endDate') || '';

  const { data, error } = await supabase.rpc('fn_client_wine_analysis', {
    p_type: type,
    p_manager: manager,
    p_department: department,
    p_client: client,
    p_start: startDate,
    p_end: endDate,
  });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    summary: data?.summary ?? null,
    byCountry: data?.byCountry ?? [],
    byRegion: data?.byRegion ?? [],
    byType: data?.byType ?? [],
    byGrape: data?.byGrape ?? [],
    byPrice: data?.byPrice ?? [],
    itemRanking: data?.itemRanking ?? [],
    prevRevenue: data?.prevRevenue ?? null,
    prevAvgDiscount: data?.prevAvgDiscount ?? null,
    prevRanking: data?.prevRanking ?? null,
  });
}
