// 와인 병샷 파일 업로드 → Storage(wine-bottles) 저장 후 공개 URL 반환.
// image_url 저장(및 노트 재생성)은 클라이언트가 기존 PATCH 흐름으로 수행 — 이 라우트는 업로드만.
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { supabase } from '@/app/lib/db';
import { isValidItemNo } from '@/app/lib/validators';

export const runtime = 'nodejs'; // sharp 사용

const BUCKET = 'wine-bottles';
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif']);

export async function POST(req: NextRequest) {
  try {
    const itemCode = req.nextUrl.searchParams.get('item_code') || '';
    if (!itemCode || !isValidItemNo(itemCode)) {
      return NextResponse.json({ error: 'item_code가 올바르지 않습니다.' }, { status: 400 });
    }
    const form = await req.formData();
    const file = form.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: '파일이 필요합니다.' }, { status: 400 });
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: `허용되지 않는 형식: ${file.type}` }, { status: 400 });
    }
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: '15MB 이하 파일만 업로드 가능합니다.' }, { status: 400 });
    }

    // EXIF 회전 보정 + 과대 이미지 축소. PNG는 투명 유지, 그 외는 JPEG 재압축.
    const raw = Buffer.from(await file.arrayBuffer());
    let buf: Buffer;
    let contentType: string;
    let ext: string;
    if (file.type === 'image/png') {
      buf = await sharp(raw).rotate().resize({ height: 1600, withoutEnlargement: true }).png().toBuffer();
      contentType = 'image/png'; ext = 'png';
    } else {
      buf = await sharp(raw).rotate().resize({ height: 1600, withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
      contentType = 'image/jpeg'; ext = 'jpg';
    }

    const path = `uploads/${itemCode}.${ext}`;
    // 확장자 다른 기존 업로드 정리
    await supabase.storage.from(BUCKET)
      .remove(['png', 'jpg'].map((e) => `uploads/${itemCode}.${e}`)).catch(() => {});
    const { error: upErr } = await supabase.storage.from(BUCKET)
      .upload(path, buf, { contentType, upsert: true });
    if (upErr) throw upErr;

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ image_url: `${pub.publicUrl}?v=${Date.now()}` });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '업로드 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
