import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

// 기본 가중치 (총 100점)
const DEFAULT_WEIGHTS: Record<string, number> = {
  REORDER: 35,
  COUNTRY_MATCH: 12,
  GRAPE_MATCH: 12,
  TYPE_MATCH: 8,
  PRICE_FIT: 10,
  SALES_VELOCITY: 8,
  SEASONAL: 10,
  UPSELL: 5,
};

// 기본 재고 기준
const DEFAULT_STOCK_RULES: Record<string, number> = {
  price_300k: 6,
  price_200k: 12,
  price_100k: 60,
  price_50k: 120,
  price_20k: 180,
  price_under_20k: 300,
  months_supply: 3,
};

const SETTINGS_KEY = 'recommend_weights';
const STOCK_KEY = 'recommend_stock_rules';

export async function GET() {
  try {
    const { data: weightRow } = await supabase
      .from('admin_settings')
      .select('value, updated_at')
      .eq('key', SETTINGS_KEY)
      .maybeSingle();

    const { data: stockRow } = await supabase
      .from('admin_settings')
      .select('value, updated_at')
      .eq('key', STOCK_KEY)
      .maybeSingle();

    const weights = weightRow ? JSON.parse(weightRow.value) : DEFAULT_WEIGHTS;
    const stockRules = stockRow ? JSON.parse(stockRow.value) : DEFAULT_STOCK_RULES;

    return NextResponse.json({
      weights,
      stockRules,
      defaults: { weights: DEFAULT_WEIGHTS, stockRules: DEFAULT_STOCK_RULES },
      updated_at: weightRow?.updated_at || null,
    });
  } catch (error) {
    console.error('Recommend settings GET error:', error);
    return NextResponse.json({ error: '설정을 불러오는 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { weights, stockRules } = await req.json();

    if (weights) {
      // 가중치 합계 검증
      const total = Object.values(weights as Record<string, number>).reduce((a, b) => a + b, 0);
      if (total < 90 || total > 110) {
        return NextResponse.json({ error: `가중치 합계가 ${total}점입니다. 100점 내외로 맞춰주세요.` }, { status: 400 });
      }

      await supabase
        .from('admin_settings')
        .upsert({
          key: SETTINGS_KEY,
          value: JSON.stringify(weights),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });
    }

    if (stockRules) {
      await supabase
        .from('admin_settings')
        .upsert({
          key: STOCK_KEY,
          value: JSON.stringify(stockRules),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Recommend settings POST error:', error);
    return NextResponse.json({ error: '설정 저장 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
