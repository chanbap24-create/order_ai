import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

const BUCKET = 'expense-files';

// GET ?manager=홍길동 → 저장된 엑셀 base64 반환
export async function GET(req: NextRequest) {
  const manager = req.nextUrl.searchParams.get('manager');
  if (!manager) {
    return NextResponse.json({ error: 'manager required' }, { status: 400 });
  }

  const filePath = `${manager}.xlsx`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(filePath);

  if (error || !data) {
    return NextResponse.json({ exists: false });
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  const base64 = buffer.toString('base64');

  return NextResponse.json({
    exists: true,
    data: base64,
    fileName: filePath,
  });
}

// PUT — FormData로 엑셀 파일 업로드 (body size limit 회피)
export async function PUT(req: NextRequest) {
  try {
    const formData = await req.formData();
    const manager = formData.get('manager') as string;
    const file = formData.get('file') as File;

    if (!manager || !file) {
      return NextResponse.json({ error: 'manager and file required' }, { status: 400 });
    }

    const filePath = `${manager}.xlsx`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
      });

    if (error) {
      console.error('Storage upload error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PUT expense file error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
