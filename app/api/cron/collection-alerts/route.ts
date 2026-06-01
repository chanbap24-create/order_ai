import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from '@/app/lib/db';
import { getEnv } from '@/app/lib/env';
import { verifyToken } from '@/app/lib/auth';
import { solapiConfigured, sendAlimtalk } from '@/app/lib/solapi';
import { buildManagerSummary, kstToday } from '@/app/lib/collection-alerts';

// 수금 연체 알림톡 일일 발송. Vercel Cron(Bearer) 또는 어드민(admin_auth) 트리거.
// ?manager=X 특정 매니저만, ?dry=1 발송 없이 미리보기.

async function authorize(req: NextRequest): Promise<boolean> {
  const secret = getEnv('CRON_SECRET');
  const auth = req.headers.get('authorization') || '';
  if (secret && auth === `Bearer ${secret}`) return true;
  const token = (await cookies()).get('admin_auth')?.value;
  if (token) {
    const p = verifyToken(token);
    if (p?.role === 'admin') return true;
  }
  return false;
}

async function run(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const onlyManager = searchParams.get('manager');
  const dryRun = searchParams.get('dry') === '1';
  const today = kstToday();

  if (!solapiConfigured() && !dryRun) {
    return NextResponse.json({ ok: false, reason: 'Solapi 미설정', configured: false });
  }

  let q = supabase.from('sales_users').select('manager, phone').not('phone', 'is', null);
  if (onlyManager) q = q.eq('manager', onlyManager);
  const { data: users } = await q;

  const { data: sent } = await supabase.from('collection_alert_log')
    .select('manager').eq('sent_date', today).eq('channel', 'alimtalk');
  const sentSet = new Set((sent || []).map(s => s.manager));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: any[] = [];
  for (const u of (users || [])) {
    if (!dryRun && sentSet.has(u.manager)) { results.push({ manager: u.manager, skipped: 'already_sent' }); continue; }
    const s = await buildManagerSummary(u.manager, today);
    if (s.total === 0) { results.push({ manager: u.manager, skipped: 'no_overdue' }); continue; }

    const variables: Record<string, string> = {
      '#{이름}': u.manager,
      '#{건수}': String(s.total),
      '#{약속어김}': String(s.broken),
      '#{특별관리}': String(s.special),
      '#{대표거래처}': s.topName,
      '#{대표금액}': s.topAmount.toLocaleString(),
    };
    const fallback = `[수금] ${u.manager}님, 오늘 챙길 미수 ${s.total}곳(약속어김 ${s.broken}, 특별관리 ${s.special}). 최대 ${s.topName} ${s.topAmount.toLocaleString()}원. 앱 브리핑 확인.`;

    if (dryRun) { results.push({ manager: u.manager, to: u.phone, variables }); continue; }

    const r = await sendAlimtalk({ to: u.phone, variables, fallbackText: fallback });
    await supabase.from('collection_alert_log').upsert({
      manager: u.manager, sent_date: today, channel: 'alimtalk',
      count: s.total, status: r.ok ? 'sent' : 'failed', detail: r.error || null,
    }, { onConflict: 'manager,sent_date,channel' });
    results.push({ manager: u.manager, sent: r.ok, error: r.error });
  }

  return NextResponse.json({ ok: true, today, count: results.length, results });
}

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return run(req);
}
export async function POST(req: NextRequest) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return run(req);
}
