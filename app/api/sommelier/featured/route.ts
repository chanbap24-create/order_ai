// 인트로 순환용 병샷 후보 — 백화점 매장 재고가 있고 병 이미지가 있는 와인 품번 목록(셔플).
import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { supabase } from '@/app/lib/db';
import { handleApiError } from '@/app/lib/errors';

const WINE_CODE = /^([0-5A]|ZK)/i;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  try {
    const codes: string[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase.from('dept_store_stock').select('item_no').range(from, from + 999);
      for (const r of data || []) if (WINE_CODE.test(r.item_no)) codes.push(r.item_no);
      if (!data || data.length < 1000) break;
    }
    const withImage: string[] = [];
    for (let i = 0; i < codes.length; i += 500) {
      const { data: ws } = await supabase
        .from('wines').select('item_code, image_url').in('item_code', codes.slice(i, i + 500))
        .not('image_url', 'is', null);
      for (const w of ws || []) if (/^https?:\/\//.test(w.image_url || '')) withImage.push(w.item_code);
    }
    // 셔플 후 12개
    for (let i = withImage.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [withImage[i], withImage[j]] = [withImage[j], withImage[i]];
    }
    return NextResponse.json({ codes: withImage.slice(0, 12) });
  } catch (e) {
    return handleApiError(e);
  }
}
