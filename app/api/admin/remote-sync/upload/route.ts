import { NextRequest, NextResponse } from 'next/server';
import { processUpload, isValidUploadType } from '@/app/lib/adminUpload';
import { logger } from '@/app/lib/logger';
import { detectNewWines, detectPriceChanges } from '@/app/lib/wineDetection';
import { supabase } from '@/app/lib/db';

// 원격 동기화 에이전트 전용 파일 업로드 (인증 면제 — middleware에서 처리)
// 지원 타입: client, dl-client, downloads, dl, riedel, english + payments, dl-payments (JSON)
const ALL_TYPES = ['client', 'dl-client', 'downloads', 'dl', 'riedel', 'english', 'payments', 'dl-payments'];

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    // JSON 전송 (재고현황 청크 또는 수금내역 등)
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const type = body.type as string;

      if (!type) return NextResponse.json({ error: 'type이 필요합니다.' }, { status: 400 });

      // 재고현황: rows 배열 직접 upsert
      if (type === 'downloads' || type === 'dl') {
        const { rows, append } = body;
        if (!rows?.length) return NextResponse.json({ success: true, items: 0 });
        const table = type === 'downloads' ? 'inventory_cdv' : 'inventory_dl';

        // CDV 전용 컬럼이 DL에 들어가는 문제 방지: 테이블에 없는 컬럼 제거
        const CDV_ONLY_COLS = ['yongma_logistics', 'yongma_reserve', 'yongma_marketing', 'yongma_sales1', 'yongma_sales2'];
        const DL_ONLY_COLS = ['gig_warehouse', 'gig_marketing', 'gig_sales1'];
        const removeCols = type === 'dl' ? CDV_ONLY_COLS : DL_ONLY_COLS;
        const cleanRows = rows.map((r: Record<string, unknown>) => {
          const clean = { ...r };
          for (const col of removeCols) delete clean[col];
          return clean;
        });

        if (!append) await supabase.from(table).delete().not('item_no', 'is', null);
        for (let i = 0; i < cleanRows.length; i += 500) {
          const { error } = await supabase.from(table).upsert(cleanRows.slice(i, i + 500), { onConflict: 'item_no' });
          if (error) throw new Error(`${table} upsert: ${error.message}`);
        }
        logger.info(`[RemoteSync] ${type}: ${cleanRows.length}건 upsert`);
        return NextResponse.json({ success: true, items: cleanRows.length });
      }

      return NextResponse.json({ error: `JSON 모드에서 지원하지 않는 타입: ${type}` }, { status: 400 });
    }

    // FormData 전송 (출고현황, 수금내역 등)
    const formData = await req.formData();
    const file = formData.get('file');
    const type = formData.get('type') as string;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
    }
    if (!type || !ALL_TYPES.includes(type)) {
      return NextResponse.json({ error: `잘못된 타입: ${type}` }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    logger.info(`[RemoteSync] Upload: type=${type}, file=${file.name}, size=${file.size}`);

    // processUpload이 지원하는 타입만 사용
    if (isValidUploadType(type)) {
      const result = await processUpload(type, buffer);

      if (type === 'downloads') {
        try { await detectPriceChanges(); await detectNewWines(); } catch { /* non-fatal */ }
      }
      return NextResponse.json({ success: true, type, ...result });
    }

    return NextResponse.json({ error: `처리할 수 없는 타입: ${type}` }, { status: 400 });
  } catch (e) {
    logger.error('[RemoteSync] Upload error', e instanceof Error ? e : undefined);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
