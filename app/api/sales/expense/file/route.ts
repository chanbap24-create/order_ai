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

// PUT { manager, data(base64) } → Storage에 엑셀 저장 (upsert)
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { manager, data: base64Data } = body;

  if (!manager || !base64Data) {
    return NextResponse.json({ error: 'manager and data required' }, { status: 400 });
  }

  const filePath = `${manager}.xlsx`;
  const buffer = Buffer.from(base64Data, 'base64');

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: true,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
