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

  const handleUpload = useCallback(async (type: string, file: File, modeOverride?: 'append' | 'replace') => {
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

        // 파싱 결과 검증
        if (payments.length === 0) {
          alert('⚠️ 수금 데이터가 0건입니다. 파일을 확인해주세요.');
          updateCard(type, { status: 'error', fileName: file.name, message: '수금 데이터 0건 - 파일 확인 필요' });
          return;
        }

        const currentPayMode = modeOverride || uploadMode[type] || 'replace';

        // 교체 모드 안전장치: 기존 DB 데이터와 비교
        if (currentPayMode === 'replace') {
          const payTable = type === 'dl-payments' ? 'dl_payments' : 'payments';
          try {
            const checkRes = await fetch(`/api/admin/upload-data/check-range?table=${payTable}`);
            const rangeData = await checkRes.json();
            if (rangeData.count && rangeData.count > payments.length * 3) {
              const ok = confirm(
                `⚠️ 교체 모드 경고!\n\n` +
                `현재 DB: ${rangeData.count}건 (${rangeData.minDate} ~ ${rangeData.maxDate})\n` +
                `업로드 파일: ${payments.length}건\n\n` +
                `기존 ${rangeData.count}건이 삭제되고 ${payments.length}건으로 교체됩니다.\n` +
                `계속하시겠습니까?`
              );
              if (!ok) {
                updateCard(type, { status: 'idle', fileName: '', message: '' });
                return;
              }
            }
          } catch { /* 체크 실패 시 그냥 진행 */ }
        }

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

        // 파일 타입 검증: 재고파일을 출고현황에 올린 경우 차단
        const headerCheck = (rows[0] as unknown[]).map(v => String(v ?? '').trim());
        const headerJoined = headerCheck.join('|');
        if (headerJoined.includes('재고수량') || headerJoined.includes('가용재고')) {
          alert('⚠️ 이 파일은 재고현황 파일입니다!\n\n"와인재고현황" 또는 "글라스재고현황" 영역에 업로드해주세요.');
          updateCard(type, { status: 'error', fileName: file.name, message: '잘못된 파일 형식 - 재고현황 파일은 재고 영역에 업로드하세요.' });
          return;
        }
        if (!headerJoined.includes('판매처') && !headerJoined.includes('출고일')) {
          alert('⚠️ 출고현황 파일이 아닌 것 같습니다.\n\n헤더에 "판매처", "출고일" 등이 없습니다.\n감지된 헤더: ' + headerCheck.filter(Boolean).slice(0, 10).join(', '));
          updateCard(type, { status: 'error', fileName: file.name, message: '잘못된 파일 형식 - 출고현황 헤더가 없습니다.' });
          return;
        }

        // 헤더 기반 동적 컬럼 매핑 (엑셀 형식 변경에 대응)
        const header = (rows[0] as unknown[]).map(v => String(v ?? '').trim());
        const col = (name: string): number => {
          // 정확 매칭 우선
          const exact = header.findIndex(h => h === name);
          if (exact >= 0) return exact;
          // 부분 매칭 폴백 (startsWith로 더 안전하게)
          return header.findIndex(h => h.startsWith(name));
        };
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
        console.log('[Upload] 컬럼 매핑:', { IDX_CLIENT_NAME, IDX_CLIENT_CODE, IDX_SHIP_DATE, IDX_ITEM_NO, IDX_ITEM_NAME, IDX_QUANTITY, IDX_MANAGER });

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
            quantity: Math.round(toNum(r[IDX_QUANTITY]) ?? 0),
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

        // 파싱 결과 검증: ship_date null이 대부분이면 컬럼 매핑 오류
        const nullDates = shipments.filter(s => !s.ship_date).length;
        const sample = shipments[0];
        if (nullDates > shipments.length * 0.5 || !sample?.ship_date) {
          const msg = `⚠️ 컬럼 매핑 오류 감지!\n\n` +
            `헤더 매핑: 판매처=[${IDX_CLIENT_NAME}], 판매처번호=[${IDX_CLIENT_CODE}], 출고일=[${IDX_SHIP_DATE}], 품번=[${IDX_ITEM_NO}], 품명=[${IDX_ITEM_NAME}], 출고수량=[${IDX_QUANTITY}], 담당자=[${IDX_MANAGER}]\n\n` +
            `첫 행 데이터:\n` +
            `  판매처: ${sample?.client_name}\n` +
            `  판매처번호: ${sample?.client_code}\n` +
            `  출고일: ${sample?.ship_date}\n` +
            `  품번: ${sample?.item_no}\n` +
            `  품명: ${sample?.item_name}\n` +
            `  수량: ${sample?.quantity}\n` +
            `  담당자: ${sample?.manager}\n\n` +
            `ship_date NULL: ${nullDates}/${shipments.length}행\n\n` +
            `엑셀 헤더: ${header.filter(Boolean).join(', ')}`;
          alert(msg);
          updateCard(type, { status: 'error', fileName: file.name, message: '컬럼 매핑 오류 - 엑셀 형식을 확인해주세요.' });
          return;
        }

        const currentMode = modeOverride || uploadMode[type] || 'replace';

        // 교체 모드 안전장치: 기존 DB 데이터와 비교
        if (currentMode === 'replace') {
          const shipTable = type === 'client' ? 'shipments' : 'glass_shipments';
          try {
            const checkRes = await fetch(`/api/admin/upload-data/check-range?table=${shipTable}`);
            const rangeData = await checkRes.json();
            if (rangeData.count && rangeData.count > shipments.length * 3) {
              const ok = confirm(
                `⚠️ 교체 모드 경고!\n\n` +
                `현재 DB: ${rangeData.count.toLocaleString()}건\n` +
                `업로드 파일: ${shipments.length.toLocaleString()}건\n\n` +
                `기존 데이터가 삭제되고 교체됩니다. 계속하시겠습니까?`
              );
              if (!ok) {
                updateCard(type, { status: 'idle', fileName: '', message: '' });
                return;
              }
            }
          } catch { /* 체크 실패 시 그냥 진행 */ }
        }

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
              throw new Error(`출고 데이터 업로드 실패: ${shipJson.error || '알 수 없는 오류'}`);
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

        // 데이터 시작 행 자동 감지: arrival_date(J열)에 날짜가 있는 첫 행
        let startRow = 2;
        for (let i = 0; i < Math.min(10, rows.length); i++) {
          const r = rows[i] as unknown[];
          const j = r[9];
          if (j && String(r[0] || '').trim() && (typeof j === 'number' || /^\d{4}[./]/.test(String(j)))) {
            startRow = i;
            break;
          }
        }

        const items: Array<{
          item_code: string; item_name_kr: string; item_name_en: string;
          brand_code: string; vintage: string; total_btls: number;
          bl_number: string; arrival_date: string;
        }> = [];

        for (let i = startRow; i < rows.length; i++) {
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
        const errMsg = json.error || `업로드 실패 (${res.status})`;
        updateCard(type, { status: 'error', message: errMsg });
        throw new Error(errMsg);
      }

      const details = Object.entries(json)
        .filter(([k]) => !['success', 'type', 'label', 'fileName', 'fileSize'].includes(k))
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');

      updateCard(type, { status: 'success', message: details || '업로드 완료' });
      onUploadComplete?.(type, json);
    } catch (e) {
      updateCard(type, { status: 'error', message: e instanceof Error ? e.message : '네트워크 오류' });
      throw e;
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

      {/* ═══ ABCosmos 자동 다운로드 ═══ */}
      <ABCosmosAutoDownload handleUpload={handleUpload} checkStatus={checkStatus} />

      {/* ═══ 스마트 일괄 업로드 ═══ */}
      <SmartBatchUpload handleUpload={handleUpload} checkStatus={checkStatus} />

      {/* 엑셀 업로드 */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>개별 업로드</h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-light)', marginBottom: 'var(--space-4)' }}>
          각 시트별 엑셀 파일을 개별 업로드합니다.
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

/* ─── Smart Batch Upload Component ─── */
type DetectedType = 'downloads' | 'dl' | 'client' | 'dl-client' | 'payments' | 'dl-payments' | 'unknown';

interface BatchFile {
  file: File;
  detectedType: DetectedType;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  overrideType?: DetectedType;
  status: 'pending' | 'uploading' | 'success' | 'error';
  message?: string;
}

const BATCH_TYPE_OPTIONS: { value: DetectedType; label: string }[] = [
  { value: 'downloads', label: '와인재고현황' },
  { value: 'dl', label: '글라스재고현황' },
  { value: 'client', label: '와인 출고현황' },
  { value: 'dl-client', label: '글라스 출고현황' },
  { value: 'payments', label: '수금내역(Wine)' },
  { value: 'dl-payments', label: '수금내역(DL)' },
];

async function detectFileType(file: File): Promise<{ type: DetectedType; confidence: 'high' | 'medium' | 'low'; reason: string }> {
  try {
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
    if (rows.length < 2) return { type: 'unknown', confidence: 'low', reason: '데이터 없음' };

    const headers = (rows[0] as unknown[]).map(h => String(h ?? '').trim());
    const headerText = headers.join('|');
    const colCount = headers.filter(h => h).length;

    // 1) 재고 파일: 헤더에 '품번', '품명', '재고수량' 등 포함
    if (headerText.includes('품번') && headerText.includes('품명') && (headerText.includes('재고수량') || headerText.includes('가용재고'))) {
      // CDV vs DL: 창고 헤더로 구분
      if (headerText.includes('용마') || headerText.includes('보세(용마)')) {
        return { type: 'downloads', confidence: 'high', reason: '재고파일 - 용마 창고 헤더 감지 (CDV)' };
      }
      if (headerText.includes('GIG') || headerText.includes('보세(GIG)')) {
        return { type: 'dl', confidence: 'high', reason: '재고파일 - GIG 창고 헤더 감지 (DL)' };
      }
      return { type: 'downloads', confidence: 'low', reason: '재고파일이나 CDV/DL 구분 불가' };
    }

    // 2) 출고현황 (client/dl-client): 컬럼 수 많음 (30+), 출하일자/거래처 패턴
    // 검사: 5번째 컬럼 부근에 거래처명, 6번째에 거래처코드, 7번째에 날짜
    if (colCount >= 30) {
      // 몇 행 샘플링해서 warehouse 값 확인
      const warehouseValues = new Set<string>();
      for (let i = 1; i < Math.min(100, rows.length); i++) {
        const r = rows[i] as unknown[];
        const wh = String(r[23] ?? '').trim();
        if (wh) warehouseValues.add(wh);
      }
      const whText = Array.from(warehouseValues).join('|');

      if (whText.includes('용마') || whText.includes('CDV') || whText.includes('안성(CDV)')) {
        return { type: 'client', confidence: 'high', reason: '출고현황 - 용마/CDV 창고 감지' };
      }
      if (whText.includes('GIG') || whText.includes('DL') || whText.includes('안성(DL)')) {
        return { type: 'dl-client', confidence: 'high', reason: '출고현황 - GIG/DL 창고 감지' };
      }

      // 파일명 힌트
      const fname = file.name.toLowerCase();
      if (fname.includes('dl') || fname.includes('글라스') || fname.includes('glass') || fname.includes('riedel')) {
        return { type: 'dl-client', confidence: 'medium', reason: '출고현황 - 파일명에 DL/글라스 포함' };
      }
      return { type: 'client', confidence: 'medium', reason: '출고현황 - 컬럼 수 30+ (CDV 추정)' };
    }

    // 3) 수금내역 (payments/dl-payments): 컬럼 ~14개, '이월' 행 존재
    if (colCount >= 10 && colCount <= 20) {
      // '이월' 행 확인
      let hasCarryover = false;
      for (let i = 1; i < Math.min(50, rows.length); i++) {
        const r = rows[i] as unknown[];
        if (r[4] === '이월') { hasCarryover = true; break; }
      }

      if (hasCarryover) {
        // CDV vs DL 구분: 부서/담당자 또는 파일명
        const fname = file.name.toLowerCase();
        if (fname.includes('dl') || fname.includes('글라스') || fname.includes('glass') || fname.includes('riedel')) {
          return { type: 'dl-payments', confidence: 'high', reason: '수금내역 - 이월행 + 파일명 DL' };
        }
        // 부서 컬럼(12) 확인
        const depts = new Set<string>();
        for (let i = 1; i < Math.min(100, rows.length); i++) {
          const r = rows[i] as unknown[];
          const dept = String(r[12] ?? '').trim();
          if (dept) depts.add(dept);
        }
        const deptText = Array.from(depts).join('|');
        if (deptText.includes('DL') || deptText.includes('글라스')) {
          return { type: 'dl-payments', confidence: 'high', reason: '수금내역 - 부서에 DL 포함' };
        }
        return { type: 'payments', confidence: 'medium', reason: '수금내역 - 이월행 감지 (CDV 추정)' };
      }
    }

    return { type: 'unknown', confidence: 'low', reason: `헤더 패턴 미매칭 (컬럼 ${colCount}개)` };
  } catch {
    return { type: 'unknown', confidence: 'low', reason: '파일 분석 실패' };
  }
}

// ══════════════════════════════════════════
// ABCosmos 자동 다운로드 컴포넌트
// ══════════════════════════════════════════
const FILE_KEY_MAP: Record<string, string> = {
  'cdv-release': 'client',
  'cdv-stock': 'downloads',
  'cdv-payment': 'payments',
  'dl-release': 'dl-client',
  'dl-stock': 'dl',
  'dl-payment': 'dl-payments',
};
const FILE_LABEL_MAP: Record<string, string> = {
  'cdv-release': '와인 출고현황',
  'cdv-stock': '와인 재고현황',
  'cdv-payment': '수금내역(Wine)',
  'dl-release': '글라스 출고현황',
  'dl-stock': '글라스 재고현황',
  'dl-payment': '수금내역(DL)',
};

interface DownloadLog {
  type: 'start' | 'progress' | 'info' | 'success' | 'fail' | 'error' | 'summary' | 'done';
  message: string;
  files?: string[];
  code?: number;
}

function ABCosmosAutoDownload({ handleUpload, checkStatus }: { handleUpload: (type: string, file: File) => Promise<void>; checkStatus: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'downloading' | 'uploading' | 'done'>('idle');
  const [logs, setLogs] = useState<DownloadLog[]>([]);
  const [expanded, setExpanded] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = (log: DownloadLog) => setLogs(prev => [...prev, log]);

  // 다운로드 → 업로드 일괄 실행
  const startSync = async (mode = 'all') => {
    setPhase('downloading');
    setLogs([]);
    setExpanded(true);

    let files: string[] = [];

    // ── Phase 1: 다운로드 ──
    try {
      const res = await fetch(`/api/admin/auto-download?mode=${mode}`);
      if (!res.body) throw new Error('스트림을 열 수 없습니다.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6)) as DownloadLog;
            addLog(data);
            if (data.type === 'done' && data.files) {
              files = data.files;
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      addLog({ type: 'error', message: err instanceof Error ? err.message : '알 수 없는 에러' });
      setPhase('done');
      return;
    }

    if (files.length === 0) {
      addLog({ type: 'error', message: '다운로드된 파일이 없습니다.' });
      setPhase('done');
      return;
    }

    // ── Phase 2: DB 업로드 ──
    setPhase('uploading');
    addLog({ type: 'summary', message: `\n═══ DB 업로드 시작 (${files.length}개) ═══` });

    let uploadSuccess = 0;
    for (const fileName of files) {
      const key = fileName.replace(/_\d+\.xlsx$/, '');
      const uploadType = FILE_KEY_MAP[key];
      if (!uploadType) continue;

      try {
        addLog({ type: 'info', message: `업로드: ${FILE_LABEL_MAP[key] || key}...` });
        const res = await fetch('/api/admin/auto-download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName }),
        });
        if (!res.ok) throw new Error('파일 가져오기 실패');

        const blob = await res.blob();
        const file = new File([blob], fileName, { type: blob.type });
        // 일괄 동기화는 항상 누적 모드 강제 (이전 월 데이터 보호)
        await handleUpload(uploadType, file, 'append');
        addLog({ type: 'success', message: `✓ ${FILE_LABEL_MAP[key]} DB 반영 완료` });
        uploadSuccess++;
      } catch (err) {
        addLog({ type: 'fail', message: `✗ ${FILE_LABEL_MAP[key]} 업로드 실패: ${err instanceof Error ? err.message : ''}` });
      }
    }

    addLog({ type: 'summary', message: `\n═══ 동기화 완료: ${uploadSuccess}/${files.length} 성공 ═══` });
    checkStatus();
    setPhase('done');
  };

  // 다운로드만 실행
  const startDownloadOnly = async (mode = 'all') => {
    setPhase('downloading');
    setLogs([]);
    setExpanded(true);

    try {
      const res = await fetch(`/api/admin/auto-download?mode=${mode}`);
      if (!res.body) throw new Error('스트림을 열 수 없습니다.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try { addLog(JSON.parse(line.slice(6)) as DownloadLog); } catch { /* skip */ }
        }
      }
    } catch (err) {
      addLog({ type: 'error', message: err instanceof Error ? err.message : '알 수 없는 에러' });
    } finally {
      setPhase('done');
    }
  };

  // 자동 스크롤
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const isBusy = phase === 'downloading' || phase === 'uploading';
  const successCount = logs.filter(l => l.type === 'success').length;
  const failCount = logs.filter(l => l.type === 'fail' || l.type === 'error').length;

  const phaseLabel = phase === 'downloading' ? 'ERP 다운로드 중...'
    : phase === 'uploading' ? 'DB 업로드 중...' : '';

  return (
    <Card style={{ marginBottom: 'var(--space-6)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </div>
          <div>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, margin: 0 }}>ERP 데이터 동기화</h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)', margin: 0 }}>
              ABCosmos ERP에서 6개 파일 다운로드 + DB 자동 반영
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
          {/* 다운로드만 버튼 */}
          <button
            onClick={() => startDownloadOnly('all')}
            disabled={isBusy}
            style={{
              padding: '8px 14px', borderRadius: 'var(--radius-md)',
              background: isBusy ? 'var(--color-border)' : 'white',
              color: isBusy ? 'var(--color-text-lighter)' : 'var(--color-text)',
              border: '1px solid var(--color-border)', fontSize: 'var(--text-sm)', fontWeight: 600,
              cursor: isBusy ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            다운로드만
          </button>
          {/* 일괄 동기화 (메인 버튼) */}
          <button
            onClick={() => startSync('all')}
            disabled={isBusy}
            style={{
              padding: '8px 20px', borderRadius: 'var(--radius-md)',
              background: isBusy ? 'var(--color-border)' : 'linear-gradient(135deg, #7c3aed, #a78bfa)',
              color: 'white', border: 'none', fontSize: 'var(--text-sm)', fontWeight: 700,
              cursor: isBusy ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: isBusy ? 'none' : '0 2px 8px rgba(124,58,237,0.3)',
            }}
          >
            {isBusy ? (
              <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} /> {phaseLabel}</>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" /></svg> 일괄 동기화</>
            )}
          </button>
        </div>
      </div>

      {/* 진행 로그 */}
      {logs.length > 0 && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          {/* 간략 상태 바 */}
          {phase === 'done' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
              padding: 'var(--space-2) var(--space-3)',
              background: failCount === 0 ? '#f0fdf4' : '#fef2f2',
              borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-2)',
              border: `1px solid ${failCount === 0 ? '#bbf7d0' : '#fecaca'}`,
            }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: failCount === 0 ? '#16a34a' : '#dc2626' }}>
                {failCount === 0 ? `${successCount}개 완료` : `${successCount}개 성공 / ${failCount}개 실패`}
              </span>
              <button
                onClick={() => setExpanded(!expanded)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 'var(--text-xs)', color: 'var(--color-text-light)', cursor: 'pointer', textDecoration: 'underline' }}
              >
                {expanded ? '로그 접기' : '로그 보기'}
              </button>
            </div>
          )}

          {/* 상세 로그 */}
          {(expanded || isBusy) && (
            <div
              ref={logRef}
              style={{
                maxHeight: 200, overflowY: 'auto',
                background: '#1e1e1e', borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6,
              }}
            >
              {logs.map((log, i) => {
                let color = '#d4d4d4';
                let prefix = '';
                if (log.type === 'success') { color = '#4ade80'; prefix = '✓ '; }
                else if (log.type === 'fail' || log.type === 'error') { color = '#f87171'; prefix = '✗ '; }
                else if (log.type === 'progress') { color = '#60a5fa'; prefix = '▸ '; }
                else if (log.type === 'info') { color = '#a78bfa'; prefix = '  '; }
                else if (log.type === 'summary' || log.type === 'done') { color = '#fbbf24'; prefix = ''; }
                return (
                  <div key={i} style={{ color, whiteSpace: 'pre-wrap' }}>
                    {prefix}{log.message}
                  </div>
                );
              })}
              {isBusy && (
                <div style={{ color: '#60a5fa' }}>
                  <span style={{ animation: 'pulse 1.5s infinite' }}>●</span> {phaseLabel}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function SmartBatchUpload({ handleUpload, checkStatus }: { handleUpload: (type: string, file: File) => Promise<void>; checkStatus: () => void }) {
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isBatchUploading, setIsBatchUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const analyzeFiles = useCallback(async (fileList: FileList | File[]) => {
    setIsAnalyzing(true);
    const newFiles: BatchFile[] = [];

    for (const file of Array.from(fileList)) {
      const name = file.name.toLowerCase();
      if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) continue;
      const { type, confidence, reason } = await detectFileType(file);
      newFiles.push({ file, detectedType: type, confidence, reason, status: 'pending' });
    }

    setFiles(prev => [...prev, ...newFiles]);
    setIsAnalyzing(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) analyzeFiles(e.dataTransfer.files);
  }, [analyzeFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) analyzeFiles(e.target.files);
    if (inputRef.current) inputRef.current.value = '';
  }, [analyzeFiles]);

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));
  const clearAll = () => setFiles([]);

  const setOverride = (idx: number, type: DetectedType) => {
    setFiles(prev => prev.map((f, i) => i === idx ? { ...f, overrideType: type === f.detectedType ? undefined : type } : f));
  };

  const getEffectiveType = (f: BatchFile): DetectedType => f.overrideType || f.detectedType;

  const batchUpload = async () => {
    const uploadable = files.filter(f => getEffectiveType(f) !== 'unknown' && f.status !== 'success');
    if (uploadable.length === 0) return;

    // 중복 타입 체크
    const typeCount = new Map<string, number>();
    for (const f of uploadable) {
      const t = getEffectiveType(f);
      typeCount.set(t, (typeCount.get(t) || 0) + 1);
    }
    const dupes = Array.from(typeCount.entries()).filter(([, c]) => c > 1);
    if (dupes.length > 0) {
      const names = dupes.map(([t]) => BATCH_TYPE_OPTIONS.find(o => o.value === t)?.label || t).join(', ');
      if (!confirm(`${names}에 여러 파일이 지정되어 있습니다. 계속하시겠습니까?`)) return;
    }

    setIsBatchUploading(true);

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const effectiveType = getEffectiveType(f);
      if (effectiveType === 'unknown' || f.status === 'success') continue;

      setFiles(prev => prev.map((pf, pi) => pi === i ? { ...pf, status: 'uploading', message: '업로드 중...' } : pf));

      try {
        await handleUpload(effectiveType, f.file);
        setFiles(prev => prev.map((pf, pi) => pi === i ? { ...pf, status: 'success', message: '완료' } : pf));
      } catch (err) {
        setFiles(prev => prev.map((pf, pi) => pi === i ? { ...pf, status: 'error', message: err instanceof Error ? err.message : '오류' } : pf));
      }
    }

    setIsBatchUploading(false);
    checkStatus();
  };

  const confidenceColor = (c: 'high' | 'medium' | 'low') =>
    c === 'high' ? '#2E7D32' : c === 'medium' ? '#E65100' : '#C62828';
  const confidenceLabel = (c: 'high' | 'medium' | 'low') =>
    c === 'high' ? '확실' : c === 'medium' ? '추정' : '불확실';

  const statusIcon = (s: BatchFile['status']) => {
    if (s === 'success') return <span style={{ color: '#2E7D32', fontSize: 18 }}>&#10003;</span>;
    if (s === 'error') return <span style={{ color: '#C62828', fontSize: 18 }}>&#10007;</span>;
    if (s === 'uploading') return <Spinner />;
    return null;
  };

  const uploadableCount = files.filter(f => getEffectiveType(f) !== 'unknown' && f.status !== 'success').length;

  return (
    <Card style={{ marginBottom: 'var(--space-6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>스마트 일괄 업로드</h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-light)', marginTop: 2 }}>
            여러 파일을 한번에 드래그하면 자동으로 파일 종류를 감지합니다
          </p>
        </div>
        {files.length > 0 && (
          <button className="btn btn-outline btn-sm" onClick={clearAll} disabled={isBatchUploading}>
            전체 초기화
          </button>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={dropRef}
        onDrop={isBatchUploading ? undefined : handleDrop}
        onDragOver={isBatchUploading ? undefined : (e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
        onDragLeave={isBatchUploading ? undefined : (e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
        onClick={() => !isBatchUploading && !isAnalyzing && inputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragOver ? 'var(--color-primary)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
          textAlign: 'center',
          cursor: isBatchUploading ? 'not-allowed' : 'pointer',
          background: isDragOver ? 'rgba(139,21,56,0.04)' : 'var(--color-background)',
          transition: 'all 0.15s',
          marginBottom: files.length > 0 ? 'var(--space-4)' : 0,
        }}
      >
        <input ref={inputRef} type="file" accept={ACCEPT} multiple style={{ display: 'none' }} onChange={handleFileInput} disabled={isBatchUploading} />
        {isAnalyzing ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Spinner />
            <span style={{ color: 'var(--color-text-light)', fontSize: 'var(--text-sm)' }}>파일 분석 중...</span>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }}>&#128194;</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-light)' }}>
              6개 파일을 한번에 드래그하거나 클릭하여 선택
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-lighter)', marginTop: 4 }}>
              재고(CDV/DL) + 출고현황(CDV/DL) + 수금(Wine/DL) 자동 감지
            </div>
          </>
        )}
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {files.map((f, idx) => {
            const effectiveType = getEffectiveType(f);
            const isOverridden = !!f.overrideType;
            const typeLabel = BATCH_TYPE_OPTIONS.find(o => o.value === effectiveType)?.label || '알 수 없음';

            return (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-4)',
                background: f.status === 'success' ? 'rgba(52,199,89,0.06)' : f.status === 'error' ? 'rgba(255,59,48,0.06)' : 'var(--color-card)',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${f.status === 'success' ? 'rgba(52,199,89,0.2)' : f.status === 'error' ? 'rgba(255,59,48,0.2)' : 'var(--color-border)'}`,
              }}>
                {/* Status icon */}
                <div style={{ width: 24, display: 'flex', justifyContent: 'center' }}>
                  {statusIcon(f.status)}
                </div>

                {/* File name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.file.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-lighter)', marginTop: 1 }}>
                    {f.reason}
                    {f.message && f.status !== 'pending' && <span> &middot; {f.message}</span>}
                  </div>
                </div>

                {/* Detected type */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                    background: effectiveType === 'unknown' ? '#FFEBEE' : isOverridden ? '#E3F2FD' : 'rgba(52,199,89,0.1)',
                    color: effectiveType === 'unknown' ? '#C62828' : isOverridden ? '#1565C0' : '#2E7D32',
                  }}>
                    {typeLabel}
                  </span>
                  {!isOverridden && effectiveType !== 'unknown' && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: confidenceColor(f.confidence) }}>
                      {confidenceLabel(f.confidence)}
                    </span>
                  )}
                </div>

                {/* Type override dropdown */}
                {f.status === 'pending' && (
                  <select
                    value={effectiveType}
                    onChange={(e) => setOverride(idx, e.target.value as DetectedType)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      fontSize: 12, padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)', background: 'var(--color-card)',
                      cursor: 'pointer', minWidth: 100,
                    }}
                  >
                    {BATCH_TYPE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                )}

                {/* Remove button */}
                {f.status === 'pending' && (
                  <button
                    onClick={() => removeFile(idx)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--color-text-lighter)', fontSize: 18, padding: '0 4px',
                      lineHeight: 1,
                    }}
                    title="제거"
                  >
                    &times;
                  </button>
                )}
              </div>
            );
          })}

          {/* Batch upload button */}
          {uploadableCount > 0 && (
            <button
              className="btn btn-primary"
              onClick={batchUpload}
              disabled={isBatchUploading}
              style={{ marginTop: 'var(--space-2)', width: '100%', padding: 'var(--space-3)' }}
            >
              {isBatchUploading ? '업로드 중...' : `${uploadableCount}개 파일 일괄 업로드`}
            </button>
          )}
        </div>
      )}
    </Card>
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
