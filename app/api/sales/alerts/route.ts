import { NextResponse } from 'next/server';
import { isValidManager, isValidItemNo } from '@/app/lib/validators';
import { resolveManagerScope } from '@/app/lib/authz';
import { scanManagerAlerts } from './lib/scan';
import { dismissItems, restoreItems, fetchDismissedList } from './lib/dismiss';

// POST: 담당자 기준 재고 부족 스캔
// body: { manager, dismissed_items?: string[] }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    // 일반 user 는 본인 manager 로 강제
    const scope = await resolveManagerScope(body.manager);
    if (!scope.ok) return scope.res;
    const manager = scope.manager || scope.session.manager;
    const dismissedItems: string[] = body.dismissed_items || [];

    if (!isValidManager(manager)) {
      return NextResponse.json({ error: 'Invalid manager name' }, { status: 400 });
    }
    // dismissed_items 는 배열 + 각 요소는 item_no 형식
    if (!Array.isArray(dismissedItems) || dismissedItems.some((x) => !isValidItemNo(x))) {
      return NextResponse.json({ error: 'Invalid dismissed_items' }, { status: 400 });
    }

    const { alerts, autoRestored } = await scanManagerAlerts(manager, dismissedItems);

    return NextResponse.json({
      alerts,
      total: alerts.length,
      out_of_stock_count: alerts.filter((a) => a.alert_type === 'out_of_stock').length,
      low_stock_count: alerts.filter((a) => a.alert_type === 'low_stock').length,
      vintage_change_count: alerts.filter((a) => a.alert_type === 'vintage_change').length,
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
    if (item_nos.some((x: unknown) => !isValidItemNo(x))) {
      return NextResponse.json({ error: 'Invalid item_no in item_nos' }, { status: 400 });
    }
    if (action !== 'dismiss' && action !== 'restore') {
      return NextResponse.json({ error: 'Invalid action (dismiss|restore)' }, { status: 400 });
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
