import { NextRequest, NextResponse } from 'next/server';
import { processUpload, isValidUploadType } from '@/app/lib/adminUpload';
import { logger } from '@/app/lib/logger';
import { detectNewWines, detectPriceChanges } from '@/app/lib/wineDetection';

// 원격 동기화 에이전트 전용 파일 업로드 (인증 면제 — middleware에서 처리)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const type = formData.get('type') as string;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
    }
    if (!type || !isValidUploadType(type)) {
      return NextResponse.json({ error: `잘못된 타입: ${type}` }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    logger.info(`[RemoteSync] Upload: type=${type}, file=${file.name}, size=${file.size}`);
    const result = await processUpload(type, buffer);

    // Downloads 업로드 시 신규 와인 감지
    if (type === 'downloads') {
      try {
        await detectPriceChanges();
        await detectNewWines();
      } catch (e) {
        logger.error('[RemoteSync] Wine detection failed', e instanceof Error ? e : undefined);
      }
    }

    return NextResponse.json({ success: true, type, ...result });
  } catch (e) {
    logger.error('[RemoteSync] Upload error', e instanceof Error ? e : undefined);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
