// 업장유형·지역별 구매 프로파일 조회/갱신. (/api/admin/* 은 middleware 로 admin_auth 게이팅)
import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { handleApiError } from '@/app/lib/errors';
import { refreshSegmentProfiles } from '@/app/lib/segmentProfiles';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('segment_profiles')
      .select('*')
      .order('client_count', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ profiles: data || [] });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST() {
  try {
    const result = await refreshSegmentProfiles();
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return handleApiError(e);
  }
}
