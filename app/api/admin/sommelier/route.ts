// 소믈리에 고객·문답·구매 이력 조회 (어드민)
import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { handleApiError } from '@/app/lib/errors';

export async function GET() {
  try {
    const [{ data: customers }, { data: sessions }, { data: orders }] = await Promise.all([
      supabase.from('sommelier_customers').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('sommelier_sessions').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('sommelier_orders').select('*').order('created_at', { ascending: false }).limit(1000),
    ]);
    return NextResponse.json({ customers: customers || [], sessions: sessions || [], orders: orders || [] });
  } catch (e) {
    return handleApiError(e);
  }
}
