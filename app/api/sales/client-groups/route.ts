// 거래처 그룹(즐겨찾기) CRUD — 영업사원 개인 소유(세션 manager 기준), 법인(client_type)별 분리.
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

type GroupClient = { code: string; name: string };

function sanitizeColumns(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out = raw.map(String).filter((k) => k.length <= 60).slice(0, 50);
  return out.length ? out : null;
}

function sanitizeClients(raw: unknown): GroupClient[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: GroupClient[] = [];
  for (const r of raw) {
    const code = String((r as GroupClient)?.code || '').trim().slice(0, 40);
    const name = String((r as GroupClient)?.name || '').trim().slice(0, 80);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push({ code, name });
  }
  return out.slice(0, 500); // 그룹당 최대 500곳
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.manager) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const type = req.nextUrl.searchParams.get('type') === 'glass' ? 'glass' : 'wine';
  const { data, error } = await supabase
    .from('client_groups')
    .select('id, name, clients, columns, updated_at')
    .eq('manager', session.manager)
    .eq('client_type', type)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ groups: data || [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.manager) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const body = await req.json();
  const type = body.client_type === 'glass' ? 'glass' : 'wine';
  const name = String(body.name || '').trim().slice(0, 40);
  const id = Number(body.id) || null;

  if (id) {
    // 수정(이름/구성원) — 본인 그룹만
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name) patch.name = name;
    if (body.clients !== undefined) patch.clients = sanitizeClients(body.clients);
    if (body.columns !== undefined) patch.columns = sanitizeColumns(body.columns);
    const { data, error } = await supabase
      .from('client_groups').update(patch)
      .eq('id', id).eq('manager', session.manager)
      .select('id, name, clients, columns, updated_at').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ group: data });
  }

  if (!name) return NextResponse.json({ error: '그룹 이름이 필요합니다.' }, { status: 400 });
  const { data, error } = await supabase
    .from('client_groups')
    .insert({ manager: session.manager, client_type: type, name, clients: sanitizeClients(body.clients) })
    .select('id, name, clients, columns, updated_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ group: data });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session?.manager) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get('id')) || 0;
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });
  const { error } = await supabase
    .from('client_groups').delete()
    .eq('id', id).eq('manager', session.manager);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
