import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

// 원격 동기화 요청 테이블: sync_requests
// { id, status: 'pending'|'running'|'done'|'error', mode, requested_at, started_at, completed_at, logs, result }

// GET: 최신 요청 상태 조회 (로컬 에이전트 폴링 + 웹 UI 상태 확인용)
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action');

  // 로컬 에이전트용: pending 요청 가져오기
  if (action === 'poll') {
    const { data } = await supabase
      .from('sync_requests')
      .select('*')
      .eq('status', 'pending')
      .order('requested_at', { ascending: true })
      .limit(1)
      .single();

    return NextResponse.json({ request: data || null });
  }

  // 웹 UI용: 최신 요청 상태
  const { data } = await supabase
    .from('sync_requests')
    .select('*')
    .order('requested_at', { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({ request: data || null });
}

// POST: 새 동기화 요청 등록 (웹에서 버튼 클릭) 또는 상태 업데이트 (로컬 에이전트)
export async function POST(req: NextRequest) {
  const body = await req.json();

  // 상태 업데이트 (로컬 에이전트가 호출)
  if (body.id && body.status) {
    const update: Record<string, unknown> = { status: body.status };
    if (body.status === 'running') update.started_at = new Date().toISOString();
    if (body.status === 'done' || body.status === 'error') {
      update.completed_at = new Date().toISOString();
      if (body.logs) update.logs = body.logs;
      if (body.result) update.result = body.result;
    }

    const { error } = await supabase
      .from('sync_requests')
      .update(update)
      .eq('id', body.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // 새 요청 등록 (웹 UI에서 호출)
  // 이미 pending/running 중인 요청이 있으면 차단
  const { data: existing } = await supabase
    .from('sync_requests')
    .select('id, status')
    .in('status', ['pending', 'running'])
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json({
      error: '이미 동기화가 진행 중입니다.',
      existing: existing,
    }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('sync_requests')
    .insert({
      status: 'pending',
      mode: body.mode || 'all',
      requested_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, request: data });
}
