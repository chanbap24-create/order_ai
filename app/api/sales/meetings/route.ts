import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { resolveManagerScope } from '@/app/lib/authz';

// icn1 (서울) 리전 강제 + Node.js 런타임
export const runtime = 'nodejs';
export const preferredRegion = 'icn1';

// GET: 미팅 목록 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    // 일반 user 는 본인 미팅 + 회사일정만 (타 매니저 미팅 조회 방지). 전체 열람 권한은 기존 동작 유지.
    const scope = await resolveManagerScope(searchParams.get('manager'));
    if (!scope.ok) return scope.res;
    const manager = scope.manager;
    const status = searchParams.get('status');
    const clientCode = searchParams.get('client_code');

    // 1) meetings만 먼저 조회 (nested join 제거로 Supabase 왕복 최소화)
    let query = supabase
      .from('meetings')
      .select('*')
      .order('meeting_date', { ascending: true })
      .order('meeting_time', { ascending: true });

    if (dateFrom) query = query.gte('meeting_date', dateFrom);
    if (dateTo) query = query.lte('meeting_date', dateTo);
    if (status) query = query.eq('status', status);
    if (clientCode) query = query.eq('client_code', clientCode);

    if (manager) {
      const safeManager = String(manager).replace(/[,.()"\\]/g, '');
      query = query.or(`manager.eq.${safeManager},is_company_event.eq.true`);
    }

    const { data: rawMeetings, error } = await query;
    if (error) throw error;

    // 2) 고유 client_code만 모아 client_details 일괄 조회 (in 쿼리 1회)
    const codes = [
      ...new Set((rawMeetings || []).map(m => m.client_code).filter(Boolean) as string[]),
    ];
    const clientMap = new Map<
      string,
      { client_name: string; importance: number; business_type: string; manager: string; contact_name: string }
    >();
    if (codes.length > 0) {
      const { data: clients } = await supabase
        .from('client_details')
        .select('client_code, client_name, importance, business_type, manager, contact_name')
        .in('client_code', codes);
      for (const c of clients || []) {
        clientMap.set(c.client_code, {
          client_name: c.client_name || '',
          importance: c.importance || 3,
          business_type: c.business_type || '',
          manager: c.manager || '',
          contact_name: c.contact_name || '',
        });
      }
    }

    const meetings = (rawMeetings || []).map((m: any) => {
      const cd = m.client_code ? clientMap.get(m.client_code) : null;
      return {
        ...m,
        client_name: cd?.client_name || m.client_code || (m.purpose?.split(' - ')?.[0]) || '(일정)',
        client_importance: cd?.importance || 3,
        client_business_type: cd?.business_type || '',
        client_manager: cd?.manager || m.manager || '',
        client_contact: cd?.contact_name || '',
      };
    });

    return NextResponse.json({ meetings });
  } catch (err) {
    console.error('GET /api/sales/meetings error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST: 미팅 생성/수정
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, client_code, meeting_date, meeting_time, meeting_type, purpose, notes, status: meetingStatus, reminder_minutes, manager: bodyManager, is_company_event } = body;

    if (!meeting_date) {
      return NextResponse.json({ error: 'meeting_date는 필수입니다.' }, { status: 400 });
    }

    if (id) {
      // UPDATE
      const updateData: any = {
        client_code: client_code || null,
        meeting_date,
        meeting_time: meeting_time || null,
        meeting_type: meeting_type || 'visit',
        purpose: purpose || null,
        notes: notes || null,
      };
      if (meetingStatus) updateData.status = meetingStatus;
      if (reminder_minutes !== undefined) updateData.reminder_minutes = reminder_minutes;

      const { data, error } = await supabase
        .from('meetings')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, meeting: data });
    } else {
      // INSERT
      const { data, error } = await supabase
        .from('meetings')
        .insert({
          client_code: client_code || null,
          meeting_date,
          meeting_time: meeting_time || null,
          meeting_type: meeting_type || 'visit',
          status: 'planned',
          purpose: purpose || null,
          notes: notes || null,
          reminder_minutes: reminder_minutes !== undefined ? reminder_minutes : null,
          manager: bodyManager || '',
          is_company_event: is_company_event || false,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, meeting: data });
    }
  } catch (err) {
    console.error('POST /api/sales/meetings error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE: 미팅 삭제
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('meetings')
      .delete()
      .eq('id', parseInt(id));

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/sales/meetings error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH: 미팅 상태 변경
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status: newStatus, notes, reminder_minutes } = body;

    if (!id || !newStatus) {
      return NextResponse.json({ error: 'id, status는 필수입니다.' }, { status: 400 });
    }

    const updateData: any = { status: newStatus };
    if (notes !== undefined) updateData.notes = notes;
    if (reminder_minutes !== undefined) updateData.reminder_minutes = reminder_minutes;

    const { data, error } = await supabase
      .from('meetings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, meeting: data });
  } catch (err) {
    console.error('PATCH /api/sales/meetings error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
