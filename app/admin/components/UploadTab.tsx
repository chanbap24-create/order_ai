'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Card from '@/app/components/ui/Card';

/* ─── 업로드 영역 정의 ─── */
const UPLOAD_AREAS = [
  { type: 'client', label: '거래처별 와인 출고현황', description: 'Client 시트 데이터', icon: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="10" y1="2" x2="14" y2="2"/><line x1="10" y1="2" x2="10" y2="8"/><line x1="14" y1="2" x2="14" y2="8"/>
      <path d="M10 8 L8 10"/><path d="M14 8 L16 10"/><line x1="8" y1="10" x2="8" y2="20"/><line x1="16" y1="10" x2="16" y2="20"/>
      <path d="M8 20 L8 21 L16 21 L16 20"/><path d="M9 14 L15 14" opacity="0.5"/>
    </svg>
  )},
  { type: 'dl-client', label: '거래처별 글라스 출고현황', description: 'DL-Client 시트 데이터', icon: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="3" x2="18" y2="3"/><path d="M7 3 L7 8 C7 10 8.5 12 12 12 C15.5 12 17 10 17 8 L17 3"/>
      <line x1="12" y1="12" x2="12" y2="19"/><line x1="9" y1="19" x2="15" y2="19"/><path d="M9 19 L9 20 L15 20 L15 19"/>
    </svg>
  )},
  { type: 'payments', label: '수금내역(Wine)', description: '와인 거래처별 수금 입금 내역', icon: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  )},
  { type: 'dl-payments', label: '수금내역(DL)', description: 'DL(RIEDEL) 거래처별 수금 입금 내역', icon: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
      <circle cx="19" cy="5" r="4" fill="var(--color-primary)" stroke="none" opacity="0.3"/>
    </svg>
  )},
  { type: 'downloads', label: '와인재고현황', description: '와인 재고 현황 데이터', icon: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  )},
  { type: 'dl', label: '글라스재고현황', description: '글라스 재고 현황 데이터', icon: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
    </svg>
  )},
  { type: 'english', label: '와인리스트', description: '와인 영문/한글 가격 리스트', icon: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  )},
  { type: 'riedel', label: '리델리스트', description: '리델 가격 리스트', icon: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  )},
  { type: 'import-schedule', label: '수입일정', description: 'CDV 미착 품목 수입 일정', icon: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/><path d="M8 2v4"/><path d="M16 2v4"/>
      <path d="M12 14l-3 3h6l-3-3z" fill="var(--color-primary)" opacity="0.3"/>
    </svg>
  )},
] as const;

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface UploadCardState {
  status: UploadStatus;
  fileName: string;
  message: string;
  isDragOver: boolean;
}

const ACCEPT = '.xlsx,.xls,.csv';

const UPLOAD_LABELS: Record<string, string> = {
  client: '거래처별 와인 출고현황',
  'dl-client': '거래처별 글라스 출고현황',
  riedel: '리델리스트',
  downloads: '와인재고현황',
  dl: '글라스재고현황',
  english: '와인리스트',
  payments: '수금내역(Wine)',
  'dl-payments': '수금내역(DL)',
  'import-schedule': '수입일정',
};

function formatTimestamp(iso: string | null): string {
  if (!iso) return '업로드 기록 없음';
  const d = new Date(iso);
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}월 ${dd}일 ${hh}:${mi}`;
}

interface UploadTabProps {
  onUploadComplete?: (type: string, result: Record<string, unknown>) => void;
}

export default function UploadTab({ onUploadComplete }: UploadTabProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [statusResult, setStatusResult] = useState<any>(null);
  const [statusError, setStatusError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [cards, setCards] = useState<Record<string, UploadCardState>>(
    Object.fromEntries(
      UPLOAD_AREAS.map((a) => [
        a.type,
        { status: 'idle' as UploadStatus, fileName: '', message: '', isDragOver: false },
      ])
    )
  );
  // 누적/교체 모드: client, dl-client, payments, dl-payments
  const [uploadMode, setUploadMode] = useState<Record<string, 'append' | 'replace'>>({
    client: 'append',
    'dl-client': 'append',
    payments: 'append',
    'dl-payments': 'append',
  });
  // shipment 마지막 날짜
  const [shipmentLastDates, setShipmentLastDates] = useState<Record<string, string | null>>({
    client: null,
    'dl-client': null,
  });
  // payment 마지막 날짜
  const [paymentLastDates, setPaymentLastDates] = useState<Record<string, string | null>>({
    payments: null,
    'dl-payments': null,
  });
  // inventory 마지막 업데이트 날짜
  const [inventoryLastDates, setInventoryLastDates] = useState<Record<string, string | null>>({
    downloads: null,
    dl: null,
  });

  const checkStatus = async () => {
    setIsChecking(true);
    setStatusError('');
    try {
      const response = await fetch('/api/sync-inventory');
      const data = await response.json();
      setStatusResult(data);
      if (data.shipmentLastDates) {
        setShipmentLastDates(data.shipmentLastDates);
      }
      if (data.paymentLastDates) {
        setPaymentLastDates(data.paymentLastDates);
      }
      if (data.inventoryLastDates) {
        setInventoryLastDates(data.inventoryLastDates);
      }
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : '상태 확인 실패');
    } finally {
      setIsChecking(false);
    }
  };

  // 마운트 시 자동으로 shipment 날짜 조회
  useEffect(() => {
    checkStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateCard(type: string, patch: Partial<UploadCardState>) {
    setCards((prev) => ({ ...prev, [type]: { ...prev[type], ...patch } }));
  }

  const handleUpload = useCallback(async (type: string, file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) return;

    updateCard(type, { status: 'uploading', fileName: file.name, message: '' });

    try {
      let res: Response;

      // 수금내역: 브라우저에서 파싱 후 JSON 전송 (wine / dl-payments 공용)
      if (type === 'payments' || type === 'dl-payments') {
        updateCard(type, { status: 'uploading', fileName: file.name, message: '파일 분석 중...' });
        const XLSX = await import('xlsx');
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });

        // 헤더: [idx, 판매처번호(1), 판매처(2), 일자(3), 구분(4), ..., 수금액(8), ..., 부서(12), 담당자(13)]
        let currentCode = '', currentName = '', currentManager = '', currentDept = '';
        const payments: Array<{ client_code: string; client_name: string; payment_date: string; amount: number; manager: string; department: string }> = [];
        const carryovers: Array<{ client_code: string; client_name: string; carryover_amount: number }> = [];

        const toDate = (v: unknown): string | null => {
          if (v == null || v === '') return null;
          if (typeof v === 'number') {
            const d = new Date((v - 25569) * 86400000);
            if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
          }
          if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
          const s = String(v).trim();
          if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(s)) return s.replace(/\//g, '-');
          return null;
        };

        for (let i = 1; i < rows.length; i++) {
          const r = rows[i] as unknown[];
          // 이월 행에서 거래처 정보 갱신 + 이월 미수금 추출
          if (r[4] === '이월' && r[1]) {
            currentCode = String(r[1]).trim().replace(/\.0$/, '');
            currentName = String(r[2] || '').trim();
            currentDept = String(r[12] || '').trim();
            currentManager = String(r[13] || '').trim();
            carryovers.push({
              client_code: currentCode,
              client_name: currentName,
              carryover_amount: Math.round(Number(r[9]) || 0),
            });
          }
          // 일계 행에서 수금액 추출 (음수=환불도 포함)
          if (r[4] === '일계' && r[8] && Number(r[8]) !== 0) {
            const date = toDate(r[3]);
            if (date && currentCode) {
              payments.push({
                client_code: currentCode,
                client_name: currentName,
                payment_date: date,
                amount: Math.round(Number(r[8])),
                manager: currentManager,
                department: currentDept,
              });
            }
          }
        }

        const currentPayMode = uploadMode[type] || 'replace';
        // append 모드: 엑셀 데이터의 최소 payment_date 계산
        let payMinDate: string | undefined;
        if (currentPayMode === 'append') {
          const dates = payments.map(p => p.payment_date).filter(Boolean);
          if (dates.length > 0) payMinDate = dates.sort()[0];
        }

        updateCard(type, { status: 'uploading', fileName: file.name, message: `${payments.length}건 수금 + ${carryovers.length}건 이월 업로드 중... (${currentPayMode === 'append' ? '누적' : '교체'})` });

        const payEndpoint = type === 'dl-payments' ? 'dl-payments' : 'payments';
        res = await fetch(`/api/admin/upload-data/${payEndpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payments, carryovers, mode: currentPayMode, minDate: payMinDate }),
        });

        if (res.ok) checkStatus();
      }
      // client/dl-client: 대용량 파일 → 브라우저에서 파싱 후 JSON 전송
      else if (type === 'client' || type === 'dl-client') {
        updateCard(type, { status: 'uploading', fileName: file.name, message: '파일 분석 중...' });
        const XLSX = await import('xlsx');
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });

        const IDX_CLIENT_NAME = 4;
        const IDX_CLIENT_CODE = 5;
        const IDX_SHIP_DATE = 6;
        const IDX_BIZ_TYPE = 7;
        const IDX_ITEM_NO = 12;
        const IDX_ITEM_NAME = 13;
        const IDX_SELLING_PRICE = 16;
        const IDX_QUANTITY = 18;
        const IDX_UNIT_PRICE = 19;
        const IDX_SUPPLY_AMT = 20;
        const IDX_TAX_AMT = 21;
        const IDX_TOTAL_AMT = 22;
        const IDX_WAREHOUSE = 23;
        const IDX_MANAGER = 37;
        const IDX_DEPARTMENT = 38;
        const IDX_PRICE = type === 'client' ? 19 : 16;

        const clients: Record<string, string> = {};
        const items: Array<{ client_code: string; item_no: string; item_name: string; supply_price: number | null }> = [];
        const seen = new Set<string>();

        interface ShipmentRow {
          client_name: string; client_code: string; ship_date: string | null;
          item_no: string; item_name: string; quantity: number;
          unit_price: number | null; selling_price: number | null;
          supply_amount: number | null; tax_amount: number | null; total_amount: number | null;
          business_type: string; manager: string; department: string; warehouse: string;
        }
        const shipments: ShipmentRow[] = [];

        const toNum = (v: unknown): number | null => {
          const n = parseFloat(String(v));
          return isFinite(n) ? n : null;
        };
        const toStr = (v: unknown): string => String(v ?? '').trim();
        const toCode = (v: unknown): string => String(v ?? '').trim().replace(/\.0$/, '');
        const toDate = (v: unknown): string | null => {
          if (v == null) return null;
          // Excel serial number
          if (typeof v === 'number') {
            const d = new Date((v - 25569) * 86400000);
            if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
          }
          // Date object
          if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
          // String date
          const s = String(v).trim();
          if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(s)) return s.replace(/\//g, '-');
          return null;
        };

        for (let i = 1; i < rows.length; i++) {
          const r = rows[i] as unknown[];
          const clientName = toStr(r[IDX_CLIENT_NAME]);
          const clientCode = toCode(r[IDX_CLIENT_CODE]);
          if (!clientName || !clientCode) continue;
          clients[clientCode] = clientName;

          const itemNo = toCode(r[IDX_ITEM_NO]);
          const itemName = toStr(r[IDX_ITEM_NAME]);
          if (!itemNo || !itemName) continue;

          const key = `${clientCode}||${itemNo}`;
          if (!seen.has(key)) {
            seen.add(key);
            const p = parseFloat(String(r[IDX_PRICE]));
            items.push({ client_code: clientCode, item_no: itemNo, item_name: itemName, supply_price: isFinite(p) ? p : null });
          }

          // 출고 트랜잭션 데이터 수집
          shipments.push({
            client_name: clientName,
            client_code: clientCode,
            ship_date: toDate(r[IDX_SHIP_DATE]),
            item_no: itemNo,
            item_name: itemName,
            quantity: toNum(r[IDX_QUANTITY]) ?? 0,
            unit_price: toNum(r[IDX_UNIT_PRICE]),
            selling_price: toNum(r[IDX_SELLING_PRICE]),
            supply_amount: toNum(r[IDX_SUPPLY_AMT]),
            tax_amount: toNum(r[IDX_TAX_AMT]),
            total_amount: toNum(r[IDX_TOTAL_AMT]),
            business_type: toStr(r[IDX_BIZ_TYPE]),
            manager: toStr(r[IDX_MANAGER]),
            department: toStr(r[IDX_DEPARTMENT]),
            warehouse: toStr(r[IDX_WAREHOUSE]),
          });
        }

        const currentMode = uploadMode[type] || 'replace';
        updateCard(type, { status: 'uploading', fileName: file.name, message: `${Object.keys(clients).length}개 거래처, ${items.length}개 품목 업로드 중... (${currentMode === 'append' ? '누적' : '교체'})` });

        // 1) clients/items 업로드 (mode 전달)
        res = await fetch(`/api/admin/upload-data/${type}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clients, items, mode: currentMode }),
        });

        if (res.ok) {
          // 2) shipments 배치 업로드 (5000행씩)
          const BATCH_SIZE = 5000;
          const shipType = type === 'client' ? 'client-shipments' : 'dl-client-shipments';
          const totalBatches = Math.ceil(shipments.length / BATCH_SIZE);

          // append 모드: 엑셀 데이터의 최소 ship_date 계산
          let minDate: string | undefined;
          if (currentMode === 'append') {
            const dates = shipments.map(s => s.ship_date).filter(Boolean) as string[];
            if (dates.length > 0) {
              minDate = dates.sort()[0];
            }
          }

          for (let b = 0; b < totalBatches; b++) {
            const batch = shipments.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
            updateCard(type, {
              status: 'uploading', fileName: file.name,
              message: `출고 트랜잭션 업로드 중... (${b + 1}/${totalBatches})`,
            });

            const shipBody: Record<string, unknown> = {
              shipments: batch,
              clear: currentMode === 'replace' && b === 0,
            };
            // append 모드: 첫 배치에서만 minDate 전달 (부분 삭제 트리거)
            if (currentMode === 'append' && b === 0 && minDate) {
              shipBody.minDate = minDate;
            }

            const shipRes = await fetch(`/api/admin/upload-data/${shipType}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(shipBody),
            });

            if (!shipRes.ok) {
              const shipJson = await shipRes.json();
              console.error('Shipment batch error:', shipJson);
            }
          }

          // 업로드 완료 후 날짜 갱신
          checkStatus();
        }
      }
      // 수입일정: 브라우저에서 파싱 후 JSON 전송
      else if (type === 'import-schedule') {
        updateCard(type, { status: 'uploading', fileName: file.name, message: '파일 분석 중...' });
        const XLSX = await import('xlsx');
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });

        // row 4부터 데이터 (index 3+)
        const items: Array<{
          item_code: string; item_name_kr: string; item_name_en: string;
          brand_code: string; vintage: string; total_btls: number;
          bl_number: string; arrival_date: string;
        }> = [];

        for (let i = 3; i < rows.length; i++) {
          const r = rows[i] as unknown[];
          const itemCode = String(r[0] || '').trim();
          const nameKr = String(r[1] || '').trim();
          const nameEn = String(r[2] || '').trim();
          const arrivalRaw = r[9];
          if (!itemCode || !arrivalRaw) continue;

          // brand_code: B열(nameKr) 첫 공백 이전 문자열
          const brandMatch = nameKr.match(/^([A-Za-z]+)\s/);
          const brandCode = brandMatch ? brandMatch[1].toUpperCase() : '';

          // arrival_date: '2026.03.11' → '2026-03-11' 또는 Excel serial
          let arrivalDate = '';
          if (typeof arrivalRaw === 'number') {
            const d = new Date((arrivalRaw - 25569) * 86400000);
            if (!isNaN(d.getTime())) arrivalDate = d.toISOString().slice(0, 10);
          } else {
            arrivalDate = String(arrivalRaw).trim().replace(/\./g, '-');
          }
          if (!arrivalDate) continue;

          const vintage = String(r[3] || '').trim();
          const totalBtls = parseInt(String(r[6] || '0'), 10) || 0;
          const blNumber = String(r[8] || '').trim();

          items.push({
            item_code: itemCode,
            item_name_kr: nameKr,
            item_name_en: nameEn,
            brand_code: brandCode,
            vintage,
            total_btls: totalBtls,
            bl_number: blNumber,
            arrival_date: arrivalDate,
          });
        }

        updateCard(type, { status: 'uploading', fileName: file.name, message: `${items.length}건 수입일정 업로드 중...` });

        res = await fetch('/api/admin/upload-data/import-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        });
      } else {
        // 그 외: 기존 FormData 방식
        const formData = new FormData();
        formData.append('file', file);
        res = await fetch(`/api/admin/upload/${type}`, { method: 'POST', body: formData });
      }

      const json = await res.json();

      if (!res.ok || !json.success) {
        updateCard(type, { status: 'error', message: json.error || `업로드 실패 (${res.status})` });
        return;
      }

      const details = Object.entries(json)
        .filter(([k]) => !['success', 'type', 'label', 'fileName', 'fileSize'].includes(k))
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');

      updateCard(type, { status: 'success', message: details || '업로드 완료' });
      onUploadComplete?.(type, json);
    } catch (e) {
      updateCard(type, { status: 'error', message: e instanceof Error ? e.message : '네트워크 오류' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      {/* DB 상태 */}
      <Card style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>DB 상태</h2>
          <button className="btn btn-outline btn-sm" onClick={checkStatus} disabled={isChecking}>
            {isChecking ? '확인 중...' : '상태 확인'}
          </button>
        </div>

        {statusError && (
          <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)', borderRadius: 'var(--radius-md)', color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>
            {statusError}
          </div>
        )}

        {statusResult?.stats && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
              <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-background)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-light)' }}>CDV (와인)</span>
                <span style={{ fontWeight: 700 }}>{(statusResult.stats?.cdv_items || 0).toLocaleString()}개</span>
              </div>
              <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-background)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-light)' }}>DL (글라스)</span>
                <span style={{ fontWeight: 700 }}>{(statusResult.stats?.dl_items || 0).toLocaleString()}개</span>
              </div>
            </div>

            {statusResult.uploadTimestamps && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-2)' }}>
                {Object.entries(statusResult.uploadTimestamps as Record<string, string | null>).map(([type, ts]) => (
                  <div key={type} style={{ padding: 'var(--space-2) var(--space-4)', background: 'var(--color-background)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-sm)' }}>
                    <span style={{ color: 'var(--color-text-light)', fontWeight: 600 }}>{UPLOAD_LABELS[type] || type}</span>
                    <span style={{ fontWeight: 500, color: ts ? 'var(--color-text)' : 'var(--color-text-lighter)', fontSize: 'var(--text-xs)' }}>{formatTimestamp(ts as string | null)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!statusResult && !statusError && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-lighter)' }}>
            상태 확인 버튼을 눌러 현재 DB 상태를 조회합니다.
          </p>
        )}
      </Card>

      {/* 엑셀 업로드 */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>엑셀 업로드</h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-light)', marginBottom: 'var(--space-4)' }}>
          각 시트별 엑셀 파일을 업로드하여 DB 데이터를 교체합니다.
        </p>
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', background: '#FFF8E1', border: '1px solid #FFE082', fontSize: 'var(--text-sm)', color: '#7C6800', marginBottom: 'var(--space-5)' }}>
          출고현황(Client/DL-Client)과 수금내역(Wine/DL)은 누적 추가/전체 교체 모드를 선택할 수 있습니다. 그 외 시트는 업로드 시 기존 데이터가 교체됩니다.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--space-5)', alignItems: 'stretch' }}>
        {UPLOAD_AREAS.map((area) => {
          const hasMode = area.type === 'client' || area.type === 'dl-client' || area.type === 'payments' || area.type === 'dl-payments';
          const lastDate = (area.type === 'client' || area.type === 'dl-client')
            ? shipmentLastDates[area.type]
            : (area.type === 'payments' || area.type === 'dl-payments')
              ? paymentLastDates[area.type]
              : (area.type === 'downloads' || area.type === 'dl')
                ? inventoryLastDates[area.type]
                : undefined;
          return (
            <UploadCard
              key={area.type}
              area={area}
              state={cards[area.type]}
              onUpload={handleUpload}
              onDragState={(over) => updateCard(area.type, { isDragOver: over })}
              uploadMode={hasMode ? uploadMode[area.type] : undefined}
              onModeChange={hasMode ? (mode) => setUploadMode(prev => ({ ...prev, [area.type]: mode })) : undefined}
              lastDate={lastDate}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ─── Upload Card Component ─── */
function UploadCard({
  area, state, onUpload, onDragState, uploadMode, onModeChange, lastDate,
}: {
  area: (typeof UPLOAD_AREAS)[number];
  state: UploadCardState;
  onUpload: (type: string, file: File) => void;
  onDragState: (over: boolean) => void;
  uploadMode?: 'append' | 'replace';
  onModeChange?: (mode: 'append' | 'replace') => void;
  lastDate?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation(); onDragState(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onUpload(area.type, file);
  }

  function handleDragOver(e: React.DragEvent) { e.preventDefault(); e.stopPropagation(); onDragState(true); }
  function handleDragLeave(e: React.DragEvent) { e.preventDefault(); e.stopPropagation(); onDragState(false); }
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onUpload(area.type, file);
    if (inputRef.current) inputRef.current.value = '';
  }

  const isUploading = state.status === 'uploading';
  const isOver = state.isDragOver;
  const borderColor = isOver ? 'var(--color-primary)' : state.status === 'success' ? 'var(--color-success)' : state.status === 'error' ? 'var(--color-error)' : 'var(--color-border)';

  const hasMode = uploadMode !== undefined && onModeChange;

  return (
    <Card style={{
      border: `2px dashed ${borderColor}`,
      background: isOver ? 'rgba(139,21,56,0.04)' : state.status === 'success' ? 'rgba(52,199,89,0.04)' : state.status === 'error' ? 'rgba(255,59,48,0.04)' : 'var(--color-card)',
      transition: 'all var(--transition-fast)',
      cursor: isUploading ? 'not-allowed' : 'default',
      opacity: isUploading ? 0.7 : 1,
      height: '100%',
      display: 'flex',
      flexDirection: 'column' as const,
    }}>
      {/* 마지막 날짜 + 모드 토글 */}
      {(hasMode || lastDate) && (
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
          {lastDate && (
            <div style={{
              display: 'inline-block', padding: '2px 10px', borderRadius: 'var(--radius-sm)',
              background: '#E3F2FD', color: '#1565C0', fontSize: '12px', fontWeight: 600,
              marginBottom: hasMode ? 'var(--space-2)' : 0,
            }}>
              {lastDate}까지 업데이트됨
            </div>
          )}
          {hasMode && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onModeChange!('append'); }}
                  style={{
                    padding: '4px 12px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                    fontSize: '12px', fontWeight: 600, transition: 'all 0.15s',
                    background: uploadMode === 'append' ? '#1565C0' : 'var(--color-background)',
                    color: uploadMode === 'append' ? '#fff' : 'var(--color-text-light)',
                  }}
                >
                  누적 추가
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onModeChange!('replace'); }}
                  style={{
                    padding: '4px 12px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                    fontSize: '12px', fontWeight: 600, transition: 'all 0.15s',
                    background: uploadMode === 'replace' ? '#C62828' : 'var(--color-background)',
                    color: uploadMode === 'replace' ? '#fff' : 'var(--color-text-light)',
                  }}
                >
                  전체 교체
                </button>
              </div>
              {uploadMode === 'replace' && (
                <div style={{ marginTop: 'var(--space-1)', fontSize: '11px', color: '#C62828' }}>
                  전체 교체 시 기존 데이터가 삭제됩니다
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div
        onDrop={isUploading ? undefined : handleDrop}
        onDragOver={isUploading ? undefined : handleDragOver}
        onDragLeave={isUploading ? undefined : handleDragLeave}
        onClick={() => !isUploading && inputRef.current?.click()}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)', padding: 'var(--space-6)', minHeight: 200, flex: 1, cursor: isUploading ? 'not-allowed' : 'pointer' }}
      >
        <input ref={inputRef} type="file" accept={ACCEPT} style={{ display: 'none' }} onChange={handleFileChange} disabled={isUploading} />
        <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-xl)', background: 'rgba(139,21,56,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {area.icon}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>{area.label}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)' }}>{area.description}</div>
        </div>

        {isUploading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'var(--space-1)' }}>
            <Spinner />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)' }}>업로드 중... {state.fileName}</span>
          </div>
        )}
        {state.status === 'success' && (
          <div style={{ fontSize: 'var(--text-xs)', color: '#2E7D32', textAlign: 'center', padding: 'var(--space-2) var(--space-3)', background: '#E8F5E9', borderRadius: 'var(--radius-sm)', maxWidth: '100%', wordBreak: 'break-all' }}>
            {state.fileName}<br />{state.message}
          </div>
        )}
        {state.status === 'error' && (
          <div style={{ fontSize: 'var(--text-xs)', color: '#C62828', textAlign: 'center', padding: 'var(--space-2) var(--space-3)', background: '#FFEBEE', borderRadius: 'var(--radius-sm)', maxWidth: '100%', wordBreak: 'break-all' }}>
            {state.message}
          </div>
        )}
        {state.status === 'idle' && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-lighter)', textAlign: 'center' }}>
            파일을 드래그하거나 클릭하여 업로드<br /><span style={{ fontSize: '11px' }}>(.xlsx, .xls, .csv)</span>
          </div>
        )}
      </div>
    </Card>
  );
}

function Spinner() {
  return (
    <>
      <div style={{ width: 16, height: 16, border: '2px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
