import { NextResponse } from 'next/server';
import { scanManagerAlerts } from './lib/scan';
import { dismissItems, restoreItems, fetchDismissedList } from './lib/dismiss';

// POST: 담당자 기준 재고 부족 스캔
// body: { manager, dismissed_items?: string[] }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const manager = body.manager;
    const dismissedItems: string[] = body.dismissed_items || [];

    if (!manager) {
      return NextResponse.json({ error: '담당자를 선택해주세요.' }, { status: 400 });
    }

    const { alerts, autoRestored } = await scanManagerAlerts(manager, dismissedItems);

    return NextResponse.json({
      alerts,
      total: alerts.length,
      out_of_stock_count: alerts.filter((a) => a.alert_type === 'out_of_stock').length,
      low_stock_count: alerts.filter((a) => a.alert_type === 'low_stock').length,
      auto_restored: autoRestored,
      scanned_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Alerts POST error:', error);
    return NextResponse.json(
      { error: '재고 스캔 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

// PATCH: 품목 dismiss/restore
// body: { item_nos: string[], action: 'dismiss' | 'restore', items?: {item_no, item_name}[] }
export async function PATCH(req: Request) {
  try {
    const { item_nos, action, items } = await req.json();
    if (!item_nos || !Array.isArray(item_nos) || item_nos.length === 0) {
      return NextResponse.json({ error: 'item_nos 배열이 필요합니다.' }, { status: 400 });
    }

    if (action === 'dismiss') {
      const { dismissed, errors } = await dismissItems(item_nos, items);
      if (errors.length > 0) {
        return NextResponse.json({
          success: false,
          error: errors.join('; '),
          dismissed,
        }, { status: 500 });
      }
      return NextResponse.json({ success: true, dismissed });
    }

    if (action === 'restore') {
      const { restored, error } = await restoreItems(item_nos);
      if (error) {
        return NextResponse.json({ success: false, error }, { status: 500 });
      }
      return NextResponse.json({ success: true, restored });
    }

    return NextResponse.json({ error: '유효하지 않은 action입니다. dismiss 또는 restore' }, { status: 400 });
  } catch (error) {
    console.error('Alerts PATCH error:', error);
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

// GET: 제외된 품목 목록 조회
export async function GET() {
  try {
    const result = await fetchDismissedList();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Alerts GET error:', error);
    return NextResponse.json(
      { error: '제외 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
