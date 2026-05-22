import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';
import { encryptFile, decryptFile } from '@/app/lib/fileCrypto';

const BUCKET = 'expense-files';

// GET ?manager=홍길동 → 저장된 엑셀 복호화 후 base64 반환
export async function GET(req: NextRequest) {
  // 세션 검증 — 로그인한 본인만 접근
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const manager = req.nextUrl.searchParams.get('manager');
  if (!manager) {
    return NextResponse.json({ error: 'manager required' }, { status: 400 });
  }

  // 본인 파일만 접근 가능 (admin/executive 제외)
  if (session.role !== 'admin' && session.role !== 'executive' && session.role !== 'sales_admin' && session.manager !== manager) {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const safeKey = Buffer.from(manager).toString('hex');
  const filePath = `m_${safeKey}.enc`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(filePath);

  if (error || !data) {
    // 기존 평문 파일(.xlsx) 마이그레이션 시도
    const legacyPath = `m_${safeKey}.xlsx`;
    const { data: legacyData } = await supabase.storage.from(BUCKET).download(legacyPath);
    if (legacyData) {
      const plainBuffer = Buffer.from(await legacyData.arrayBuffer());
      // 암호화 후 새 파일로 저장, 기존 삭제
      const encrypted = encryptFile(plainBuffer, manager);
      await supabase.storage.from(BUCKET).upload(filePath, new Uint8Array(encrypted), {
        contentType: 'application/octet-stream',
      });
      await supabase.storage.from(BUCKET).remove([legacyPath]);
      return NextResponse.json({
        exists: true,
        data: plainBuffer.toString('base64'),
      });
    }
    return NextResponse.json({ exists: false });
  }

  try {
    const encBuffer = Buffer.from(await data.arrayBuffer());
    const decrypted = decryptFile(encBuffer, manager);
    return NextResponse.json({
      exists: true,
      data: decrypted.toString('base64'),
    });
  } catch {
    return NextResponse.json({ error: '복호화 실패' }, { status: 500 });
  }
}

// PUT — FormData로 엑셀 파일 암호화 후 업로드
export async function PUT(req: NextRequest) {
  try {
    // 세션 검증
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const formData = await req.formData();
    const manager = formData.get('manager') as string;
    const file = formData.get('file') as File;

    if (!manager || !file) {
      return NextResponse.json({ error: 'manager and file required' }, { status: 400 });
    }

    // 본인 파일만 수정 가능
    if (session.role !== 'admin' && session.role !== 'executive' && session.role !== 'sales_admin' && session.manager !== manager) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const safeKey = Buffer.from(manager).toString('hex');
    const filePath = `m_${safeKey}.enc`;

    // 파일 암호화
    const arrayBuffer = await file.arrayBuffer();
    const plainBuffer = Buffer.from(arrayBuffer);
    const encrypted = encryptFile(plainBuffer, manager);

    // 기존 파일 삭제 후 업로드
    await supabase.storage.from(BUCKET).remove([filePath]);
    // 기존 평문 파일도 삭제 (마이그레이션)
    const legacyPath = `m_${safeKey}.xlsx`;
    await supabase.storage.from(BUCKET).remove([legacyPath]);

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, new Uint8Array(encrypted), {
        contentType: 'application/octet-stream',
      });

    if (error) {
      console.error('Storage upload error:', JSON.stringify(error));
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PUT expense file error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
