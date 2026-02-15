import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

interface GradeRule {
  manager: string;
  client_type: string;
  business_type: string;
  vip_threshold: number;
  important_threshold: number;
  normal_threshold: number;
  occasional_threshold: number;
  listing_vip: number;
  listing_important: number;
  listing_normal: number;
  listing_occasional: number;
  listing_months: number;
}

const DEFAULT_WINE: Omit<GradeRule, 'manager' | 'client_type' | 'business_type'> = {
  vip_threshold: 100000000,
  important_threshold: 50000000,
  normal_threshold: 10000000,
  occasional_threshold: 1000000,
  listing_vip: 15,
  listing_important: 10,
  listing_normal: 5,
  listing_occasional: 2,
  listing_months: 6,
};

const DEFAULT_GLASS: Omit<GradeRule, 'manager' | 'client_type' | 'business_type'> = {
  vip_threshold: 50000000,
  important_threshold: 20000000,
  normal_threshold: 5000000,
  occasional_threshold: 500000,
  listing_vip: 10,
  listing_important: 7,
  listing_normal: 3,
  listing_occasional: 1,
  listing_months: 6,
};

// GET: 등급 기준 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const manager = searchParams.get('manager');
    const clientType = searchParams.get('type') || 'wine';
    const businessType = searchParams.get('business_type') || '_all';

    const defaults = clientType === 'glass' ? DEFAULT_GLASS : DEFAULT_WINE;

    if (manager) {
      // 1. 담당+업종 정확 매칭
      const { data: exact } = await supabase
        .from('grade_rules')
        .select('*')
        .eq('manager', manager)
        .eq('client_type', clientType)
        .eq('business_type', businessType)
        .single();

      if (exact) {
        return NextResponse.json({ rule: exact, matchType: 'exact' });
      }

      // 2. 담당+전체업종(_all) 폴백
      if (businessType !== '_all') {
        const { data: managerAll } = await supabase
          .from('grade_rules')
          .select('*')
          .eq('manager', manager)
          .eq('client_type', clientType)
          .eq('business_type', '_all')
          .single();

        if (managerAll) {
          return NextResponse.json({ rule: managerAll, matchType: 'manager_all', isDefault: true });
        }
      }

      // 3. _default+업종 폴백
      const { data: defaultBiz } = await supabase
        .from('grade_rules')
        .select('*')
        .eq('manager', '_default')
        .eq('client_type', clientType)
        .eq('business_type', businessType)
        .single();

      if (defaultBiz) {
        return NextResponse.json({ rule: defaultBiz, matchType: 'default_biz', isDefault: true });
      }

      // 4. _default+_all 최종 폴백
      const { data: defaultAll } = await supabase
        .from('grade_rules')
        .select('*')
        .eq('manager', '_default')
        .eq('client_type', clientType)
        .eq('business_type', '_all')
        .single();

      return NextResponse.json({
        rule: defaultAll || {
          manager: '_default',
          client_type: clientType,
          business_type: '_all',
          ...defaults,
        },
        matchType: 'default_all',
        isDefault: true,
      });
    }

    // 전체 기준 목록
    const { data, error } = await supabase
      .from('grade_rules')
      .select('*')
      .eq('client_type', clientType)
      .order('manager')
      .order('business_type');

    if (error) throw error;
    return NextResponse.json({ rules: data || [] });
  } catch (err) {
    console.error('GET /api/sales/grade-rules error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown' }, { status: 500 });
  }
}

// POST: 등급 기준 저장 (upsert)
export async function POST(req: NextRequest) {
  try {
    const body: GradeRule = await req.json();
    const {
      manager, client_type, business_type,
      vip_threshold, important_threshold, normal_threshold, occasional_threshold,
      listing_vip, listing_important, listing_normal, listing_occasional, listing_months,
    } = body;

    if (!manager) {
      return NextResponse.json({ error: 'manager is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('grade_rules')
      .upsert({
        manager,
        client_type: client_type || 'wine',
        business_type: business_type || '_all',
        vip_threshold,
        important_threshold,
        normal_threshold,
        occasional_threshold,
        listing_vip: listing_vip ?? 15,
        listing_important: listing_important ?? 10,
        listing_normal: listing_normal ?? 5,
        listing_occasional: listing_occasional ?? 2,
        listing_months: listing_months ?? 6,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'manager,client_type,business_type' })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, rule: data });
  } catch (err) {
    console.error('POST /api/sales/grade-rules error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown' }, { status: 500 });
  }
}
