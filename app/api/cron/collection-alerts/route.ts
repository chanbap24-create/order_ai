import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from '@/app/lib/db';
import { getEnv } from '@/app/lib/env';
import { verifyToken } from '@/app/lib/auth';
import { solapiConfigured, sendAlimtalk } from '@/app/lib/solapi';
import { telegramConfigured, sendTelegram, escapeHtml } from '@/app/lib/telegram';
import { buildManagerSummary, kstToday } from '@/app/lib/collection-alerts';

// 수금 연체 알림 일일 발송 (텔레그램 DM + 알림톡). Vercel Cron(Bearer) 또는 어드민(admin_auth) 트리거.
// ?manager=X 특정 매니저만, ?dry=1 발송 없이 미리보기.

export const maxDuration = 300; // 매니저 수 × aging RPC — 직렬 지연 대비

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

  if (!solapiConfigured() && !telegramConfigured() && !dryRun) {
    return NextResponse.json({ ok: false, reason: 'Solapi/텔레그램 모두 미설정', configured: false });
  }

  let q = supabase.from('sales_users').select('manager, phone, telegram_chat_id')
    .or('phone.not.is.null,telegram_chat_id.not.is.null');
  if (onlyManager) q = q.eq('manager', onlyManager);
  const { data: users } = await q;

  const { data: sent } = await supabase.from('collection_alert_log')
    .select('manager, channel').eq('sent_date', today);
  const sentSet = new Set((sent || []).map(s => `${s.manager}|${s.channel}`));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: any[] = [];
  // 매니저별 처리 — aging RPC 2개+발송이 무거워 직렬이면 타임아웃 위험 → 3명씩 병렬
  const processUser = async (u: { manager: string; phone: string | null; telegram_chat_id: string | null }) => {
    const s = await buildManagerSummary(u.manager, today);
    if (s.total === 0) { results.push({ manager: u.manager, skipped: 'no_overdue' }); return; }

    const logSend = (channel: string, ok: boolean, error?: string | null) =>
      supabase.from('collection_alert_log').upsert({
        manager: u.manager, sent_date: today, channel,
        count: s.total, status: ok ? 'sent' : 'failed', detail: error || null,
      }, { onConflict: 'manager,sent_date,channel' });

    // ── 텔레그램 DM (연동자) ──
    if (u.telegram_chat_id && telegramConfigured()) {
      if (!dryRun && sentSet.has(`${u.manager}|telegram`)) {
        results.push({ manager: u.manager, channel: 'telegram', skipped: 'already_sent' });
      } else {
        const html = [
          `🔔 <b>수금 브리핑</b> — ${today}`,
          `오늘 챙길 미수 <b>${s.total}곳</b>`,
          `· 오늘 약속 ${s.promiseToday} · 약속 어김 ${s.broken} · 연체 ${s.overdue} (특별관리 ${s.special})`,
          s.topName ? `최대: ${escapeHtml(s.topName)} ${s.topAmount.toLocaleString()}원` : '',
          `<a href="https://order-ai-one.vercel.app/sales">미수현황 열기</a>`,
        ].filter(Boolean).join('\n');
        if (dryRun) {
          results.push({ manager: u.manager, channel: 'telegram', preview: html });
        } else {
          const r = await sendTelegram(u.telegram_chat_id, html);
          await logSend('telegram', r.ok, r.error);
          results.push({ manager: u.manager, channel: 'telegram', sent: r.ok, error: r.error });
        }
      }
    }

    // ── 카카오 알림톡 (Solapi 설정 시) ──
    if (u.phone && solapiConfigured()) {
      if (!dryRun && sentSet.has(`${u.manager}|alimtalk`)) {
        results.push({ manager: u.manager, channel: 'alimtalk', skipped: 'already_sent' });
        return;
      }
      const variables: Record<string, string> = {
        '#{이름}': u.manager,
        '#{건수}': String(s.total),
        '#{약속어김}': String(s.broken),
        '#{특별관리}': String(s.special),
        '#{대표거래처}': s.topName,
        '#{대표금액}': s.topAmount.toLocaleString(),
      };
      const fallback = `[수금] ${u.manager}님, 오늘 챙길 미수 ${s.total}곳(약속어김 ${s.broken}, 특별관리 ${s.special}). 최대 ${s.topName} ${s.topAmount.toLocaleString()}원. 앱 브리핑 확인.`;
      if (dryRun) { results.push({ manager: u.manager, channel: 'alimtalk', to: u.phone, variables }); return; }
      const r = await sendAlimtalk({ to: u.phone, variables, fallbackText: fallback });
      await logSend('alimtalk', r.ok, r.error);
      results.push({ manager: u.manager, channel: 'alimtalk', sent: r.ok, error: r.error });
    }
  };

  const list = users || [];
  for (let i = 0; i < list.length; i += 3) {
    await Promise.all(list.slice(i, i + 3).map((u) =>
      processUser(u).catch((e) => results.push({ manager: u.manager, error: e instanceof Error ? e.message : String(e) }))));
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
