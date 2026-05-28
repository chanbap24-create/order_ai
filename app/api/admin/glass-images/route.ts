/**
 * 글라스 이미지 관리 API
 * - GET    /api/admin/glass-images                → glass_specs 목록 (이미지 유무 포함)
 * - POST   /api/admin/glass-images?item_no=...    → multipart 파일 업로드 + image_url 갱신
 * - DELETE /api/admin/glass-images?item_no=...    → Storage 파일 + image_url null
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

const BUCKET = 'glass-images';
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('glass_specs')
      .select('item_no, glass_code, series, description, height_cm, capacity_ml, image_url, updated_at')
      .order('item_no', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ items: data || [] });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const itemNo = req.nextUrl.searchParams.get('item_no');
    if (!itemNo) {
      return NextResponse.json({ error: 'item_no required' }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'file required' }, { status: 400 });
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: `허용되지 않는 형식: ${file.type}` }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: '10MB 이하 파일만 업로드 가능' }, { status: 400 });
    }

    // 확장자
    const extMap: Record<string, string> = {
      'image/png': 'png', 'image/jpeg': 'jpeg', 'image/webp': 'webp', 'image/gif': 'gif',
    };
    const ext = extMap[file.type] || 'png';
    const storagePath = `${itemNo}.${ext}`;

    // 기존 파일 모두 삭제 (확장자 다른 경우 대비)
    const candidates = ['png', 'jpeg', 'jpg', 'webp', 'gif'].map((e) => `${itemNo}.${e}`);
    await supabase.storage.from(BUCKET).remove(candidates).catch(() => {});

    // 업로드
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buf, { contentType: file.type, upsert: true });
    if (upErr) throw upErr;

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const image_url = `${pub.publicUrl}?v=${Date.now()}`;

    // glass_specs 업데이트
    const { error: dbErr } = await supabase
      .from('glass_specs')
      .update({ image_url })
      .eq('item_no', itemNo);
    if (dbErr) throw dbErr;

    return NextResponse.json({ success: true, item_no: itemNo, image_url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

/** PATCH: 스펙(height_cm, capacity_ml, series, description, glass_code, remark) 인라인 업데이트 */
export async function PATCH(req: NextRequest) {
  try {
    const itemNo = req.nextUrl.searchParams.get('item_no');
    if (!itemNo) {
      return NextResponse.json({ error: 'item_no required' }, { status: 400 });
    }
    const body = await req.json();
    const allowed = ['height_cm', 'capacity_ml', 'series', 'description', 'glass_code', 'remark'] as const;
    const updates: Record<string, unknown> = {};
    for (const k of allowed) {
      if (k in body) {
        const v = body[k];
        if (k === 'height_cm' || k === 'capacity_ml') {
          updates[k] = v === '' || v == null ? null : Number(v);
        } else {
          updates[k] = v === '' ? null : v;
        }
      }
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '수정할 필드 없음' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('glass_specs')
      .update(updates)
      .eq('item_no', itemNo)
      .select()
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ success: true, item: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const itemNo = req.nextUrl.searchParams.get('item_no');
    if (!itemNo) {
      return NextResponse.json({ error: 'item_no required' }, { status: 400 });
    }

    const candidates = ['png', 'jpeg', 'jpg', 'webp', 'gif'].map((e) => `${itemNo}.${e}`);
    await supabase.storage.from(BUCKET).remove(candidates).catch(() => {});

    const { error: dbErr } = await supabase
      .from('glass_specs')
      .update({ image_url: null })
      .eq('item_no', itemNo);
    if (dbErr) throw dbErr;

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
