import { NextRequest, NextResponse } from 'next/server';
import { processUpload, isValidUploadType, processShipmentsFromData } from '@/app/lib/adminUpload';
import type { ShipmentRow } from '@/app/lib/adminUpload';
import { logger } from '@/app/lib/logger';
import { detectNewWines, detectPriceChanges } from '@/app/lib/wineDetection';
import { supabase } from '@/app/lib/db';
import * as XLSX from 'xlsx';

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
        const CDV_ONLY_COLS = ['yongma_logistics', 'yongma_reserve', 'yongma_marketing', 'yongma_sales1', 'yongma_sales2', 'kctc', 'bonded_kctc'];
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

    // 출고현황: 거래처+품목 + shipments 모두 처리
    if (type === 'client' || type === 'dl-client') {
      // 1) 거래처+품목 마스터
      const result = await processUpload(type, buffer);

      // 2) shipments 파싱 + DB insert (append 모드)
      try {
        const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
        const header = (rows[0] as unknown[]).map(v => String(v ?? '').trim());
        const col = (name: string) => { const e = header.indexOf(name); return e >= 0 ? e : header.findIndex(h => h.startsWith(name)); };

        const IDX_CLIENT_NAME = col('판매처') >= 0 && col('판매처') !== col('판매처번호') ? col('판매처') : 4;
        const IDX_CLIENT_CODE = col('판매처번호') >= 0 ? col('판매처번호') : 5;
        const IDX_SHIP_DATE = col('출고일') >= 0 ? col('출고일') : 6;
        const IDX_BIZ_TYPE = col('업종구분') >= 0 ? col('업종구분') : 7;
        const IDX_ITEM_NO = col('품번') >= 0 ? col('품번') : 12;
        const IDX_ITEM_NAME = col('품명') >= 0 ? col('품명') : 13;
        const IDX_SELLING_PRICE = col('판매단가') >= 0 ? col('판매단가') : 16;
        const IDX_QUANTITY = col('출고수량') >= 0 ? col('출고수량') : 18;
        const IDX_UNIT_PRICE = col('기준단가') >= 0 ? col('기준단가') : 19;
        const IDX_SUPPLY_AMT = col('공급가액') >= 0 ? col('공급가액') : 20;
        const IDX_TAX_AMT = col('세액') >= 0 ? col('세액') : 21;
        const IDX_TOTAL_AMT = col('합계금액') >= 0 ? col('합계금액') : 22;
        const IDX_WAREHOUSE = col('창고') >= 0 ? col('창고') : 23;
        const IDX_MANAGER = col('담당자') >= 0 ? col('담당자') : 37;
        const IDX_DEPARTMENT = col('부서') >= 0 ? col('부서') : 38;
        const IDX_PRICE = type === 'client' ? IDX_UNIT_PRICE : IDX_SELLING_PRICE;

        const toStr = (v: unknown) => String(v ?? '').trim();
        const toCode = (v: unknown) => String(v ?? '').trim().replace(/\.0$/, '');
        const toNum = (v: unknown) => { const n = parseFloat(String(v)); return isFinite(n) ? n : null; };
        const toDate = (v: unknown): string | null => {
          if (v == null) return null;
          if (typeof v === 'number') { const d = new Date((v - 25569) * 86400000); return !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null; }
          if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
          const s = String(v).trim(); return /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(s) ? s.replace(/\//g, '-') : null;
        };

        const shipments: ShipmentRow[] = [];
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i] as unknown[];
          const clientName = toStr(r[IDX_CLIENT_NAME]);
          const clientCode = toCode(r[IDX_CLIENT_CODE]);
          const shipDate = toDate(r[IDX_SHIP_DATE]);
          const itemNo = toCode(r[IDX_ITEM_NO]);
          const itemName = toStr(r[IDX_ITEM_NAME]);
          const quantity = toNum(r[IDX_QUANTITY]);
          if (!clientCode || !itemNo || !shipDate || !quantity) continue;
          shipments.push({
            client_name: clientName, client_code: clientCode, ship_date: shipDate,
            item_no: itemNo, item_name: itemName, quantity: quantity || 0,
            unit_price: toNum(r[IDX_PRICE]), selling_price: toNum(r[IDX_SELLING_PRICE]),
            supply_amount: toNum(r[IDX_SUPPLY_AMT]), tax_amount: toNum(r[IDX_TAX_AMT]), total_amount: toNum(r[IDX_TOTAL_AMT]),
            business_type: toStr(r[IDX_BIZ_TYPE]), manager: toStr(r[IDX_MANAGER]),
            department: toStr(r[IDX_DEPARTMENT]), warehouse: toStr(r[IDX_WAREHOUSE]),
          });
        }

        if (shipments.length > 0) {
          const table = type === 'client' ? 'shipments' : 'glass_shipments';
          const minDate = shipments.map(s => s.ship_date).filter(Boolean).sort()[0];
          const shipResult = await processShipmentsFromData(shipments, table, false, minDate || undefined);
          logger.info(`[RemoteSync] ${type} shipments: ${shipResult.inserted}건 (minDate: ${minDate})`);

          // 거래명세표 업데이트 직후 — 이번 batch 에 포함된 거래처의 client_details.manager 를
          // 최근 12개월 dominant 출고 매니저로 자동 보정 (퇴사자 제외).
          // wine(client) 일 때만 적용 — glass 는 glass_clients 별도 관리.
          let managerSynced = 0;
          if (type === 'client') {
            try {
              const codes = Array.from(new Set(shipments.map(s => s.client_code).filter(Boolean)));
              const { data: synced, error: syncErr } = await supabase.rpc('fn_sync_client_managers', {
                p_codes: codes,
              });
              if (syncErr) {
                logger.error('[RemoteSync] manager sync failed', syncErr instanceof Error ? syncErr : new Error(String(syncErr)));
              } else {
                managerSynced = synced?.length || 0;
                logger.info(`[RemoteSync] client_details.manager 자동 보정: ${managerSynced}건`);
              }
            } catch (e) {
              logger.error('[RemoteSync] manager sync exception', e instanceof Error ? e : undefined);
            }
          }

          return NextResponse.json({
            success: true,
            type,
            ...result,
            shipments: shipResult.inserted,
            managerSynced,
          });
        }
      } catch (e) {
        logger.error('[RemoteSync] Shipment parsing failed', e instanceof Error ? e : undefined);
      }

      return NextResponse.json({ success: true, type, ...result });
    }

    // 기타 processUpload 지원 타입
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
