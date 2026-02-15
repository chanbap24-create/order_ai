import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

// GET: 미팅 목록 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const manager = searchParams.get('manager');
    const status = searchParams.get('status');
    const clientCode = searchParams.get('client_code');

    let query = supabase
      .from('meetings')
      .select('*, client_details(client_name, importance, business_type, manager, contact_name)')
      .order('meeting_date', { ascending: true })
      .order('meeting_time', { ascending: true });

    if (dateFrom) query = query.gte('meeting_date', dateFrom);
    if (dateTo) query = query.lte('meeting_date', dateTo);
    if (status) query = query.eq('status', status);
    if (clientCode) query = query.eq('client_code', clientCode);

    // manager 필터: client_details.manager로 필터
    // Supabase에서는 FK 테이블 직접 필터 어려우므로 후처리
    const { data, error } = await query;
    if (error) throw error;

    let meetings = (data || []).map((m: any) => ({
      ...m,
      client_name: m.client_details?.client_name || m.client_code,
      client_importance: m.client_details?.importance || 3,
      client_business_type: m.client_details?.business_type || '',
      client_manager: m.client_details?.manager || '',
      client_contact: m.client_details?.contact_name || '',
    }));

    // manager 필터 후처리
    if (manager) {
      meetings = meetings.filter((m: any) => m.client_manager === manager);
    }

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
    const { id, client_code, meeting_date, meeting_time, meeting_type, purpose, notes, status: meetingStatus } = body;

    if (!client_code || !meeting_date) {
      return NextResponse.json({ error: 'client_code, meeting_date는 필수입니다.' }, { status: 400 });
    }

    if (id) {
      // UPDATE
      const updateData: any = {
        client_code,
        meeting_date,
        meeting_time: meeting_time || null,
        meeting_type: meeting_type || 'visit',
        purpose: purpose || null,
        notes: notes || null,
      };
      if (meetingStatus) updateData.status = meetingStatus;

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
          client_code,
          meeting_date,
          meeting_time: meeting_time || null,
          meeting_type: meeting_type || 'visit',
          status: 'planned',
          purpose: purpose || null,
          notes: notes || null,
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
    const { id, status: newStatus, notes } = body;

    if (!id || !newStatus) {
      return NextResponse.json({ error: 'id, status는 필수입니다.' }, { status: 400 });
    }

    const updateData: any = { status: newStatus };
    if (notes !== undefined) updateData.notes = notes;

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
