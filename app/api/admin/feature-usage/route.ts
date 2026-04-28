import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { isValidDate } from '@/app/lib/validators';

/**
 * GET /api/admin/feature-usage?start=YYYY-MM-DD&end=YYYY-MM-DD&manager=...
 *  - 관리자 인증은 미들웨어에서 처리.
 *  - 응답: { rows: [{ usage_date, manager, feature, count, last_used_at }], totals_by_manager, totals_by_feature, managers, features, days }
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const manager = searchParams.get('manager') || '';

    if (!start || !end || !isValidDate(start) || !isValidDate(end)) {
      return NextResponse.json({ error: 'start, end (YYYY-MM-DD) required' }, { status: 400 });
    }
    if (start > end) {
      return NextResponse.json({ error: 'start must be <= end' }, { status: 400 });
    }

    let q = supabase
      .from('feature_usage_daily')
      .select('usage_date, manager, feature, count, last_used_at')
      .gte('usage_date', start)
      .lte('usage_date', end)
      .order('usage_date', { ascending: false })
      .order('count', { ascending: false });

    if (manager) q = q.eq('manager', manager);

    // 페이지네이션 (안전상한)
    type RowT = { usage_date: string; manager: string; feature: string; count: number; last_used_at: string };
    const rows: RowT[] = [];
    let from = 0;
    const batch = 1000;
    while (true) {
      const { data, error } = await q.range(from, from + batch - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < batch) break;
      from += batch;
      if (from >= 10000) break; // 안전 상한
    }

    // 매니저별 합계
    const byManager = new Map<string, number>();
    const byFeature = new Map<string, number>();
    const days = new Set<string>();
    const managerSet = new Set<string>();
    const featureSet = new Set<string>();
    for (const r of rows) {
      byManager.set(r.manager, (byManager.get(r.manager) || 0) + r.count);
      byFeature.set(r.feature, (byFeature.get(r.feature) || 0) + r.count);
      days.add(r.usage_date);
      managerSet.add(r.manager);
      featureSet.add(r.feature);
    }

    const totalsByManager = [...byManager.entries()]
      .map(([k, v]) => ({ manager: k, count: v }))
      .sort((a, b) => b.count - a.count);
    const totalsByFeature = [...byFeature.entries()]
      .map(([k, v]) => ({ feature: k, count: v }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      rows,
      totals_by_manager: totalsByManager,
      totals_by_feature: totalsByFeature,
      managers: [...managerSet].sort(),
      features: [...featureSet].sort(),
      days: [...days].sort().reverse(),
      total_count: rows.reduce((s, r) => s + r.count, 0),
    });
  } catch (err) {
    console.error('GET /api/admin/feature-usage error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
