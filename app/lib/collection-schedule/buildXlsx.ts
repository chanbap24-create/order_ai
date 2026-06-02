import ExcelJS from 'exceljs';
import { computeCols, type ScheduleClient } from './compute';

// 수금일정표 양식과 완전 동일하게 작성 (열너비/숨김/행높이/폰트/숫자서식/필터).
// 양식 기준값 — 열너비는 양식 원본 그대로.
const WIDTHS = [8.28515625, 16.7109375, 25, 16.7109375, 10, 13.28515625, 13.28515625, 13.28515625, 13.28515625, 13.28515625, 13.28515625, 25, 21.7109375, 10, 12.7109375, 11.28515625, 11, 8.85546875];
const HIDDEN = new Set([6, 7, 8, 9, 11, 12, 13, 14]);
const HEADERS = ['순번', '판매처번호', '판매처', '일자', '구분', '공급가액', '세액', '판매액', '수금액', '미수금', '업종구분', '대표거래처', '부서', '담당자', '입금예정금액', '미수잔액', '입금예정일', '비고'];

const FONT = { name: '맑은 고딕', size: 10, family: 2, scheme: 'minor', color: { theme: 1 } } as const;
const FONT12 = { name: '맑은 고딕', size: 12, family: 2, scheme: 'minor', color: { theme: 1 } } as const;
// 입금예정금액/입금예정일 강조 채움 (양식과 동일: theme 2)
const FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { theme: 2 }, bgColor: { indexed: 64 } };
const FMT_EXP = '#,##0;(#,##0);-';                          // 입금예정금액
const FMT_ACC = '_-* #,##0_-;-* #,##0_-;_-* "-"_-;_-@_-';   // 미수잔액(회계)
const FMT_DATE = 'yyyy-mm-dd';                             // 입금예정일

function styleRow(row: ExcelJS.Row) {
  for (let c = 1; c <= 18; c++) row.getCell(c).font = { ...FONT };
  row.getCell(15).numFmt = FMT_EXP; row.getCell(15).font = { ...FONT12 };   // 입금예정금액
  row.getCell(16).numFmt = FMT_ACC;                                          // 미수잔액
  const q = row.getCell(17); q.numFmt = FMT_DATE; q.fill = FILL;             // 입금예정일
  row.height = 15;
}

function addSheet(wb: ExcelJS.Workbook, name: string, clients: ScheduleClient[], todayISO: string, dept: string, manager: string) {
  const ws = wb.addWorksheet(name, { views: [{ zoomScale: 97 }] });
  ws.properties.defaultRowHeight = 15;
  WIDTHS.forEach((w, i) => { const col = ws.getColumn(i + 1); col.width = w; if (HIDDEN.has(i + 1)) col.hidden = true; });

  // 안내문 (양식 1~4행)
  ws.getCell('R1').value = '노란색 표시:'; ws.getCell('S1').value = 'OFF';
  ws.getCell('O2').value = '** 미수잔액 : 현미수 - 입금예정금액 수식 걸려있음 ';
  ws.getCell('O3').value = '** 결제예정일 : 날짜 양식으로 통일 (ex. 2026-03-03)';
  ws.getCell('O4').value = '** 필요없는 항목들은 숨기기 되어있습니다. 숨기기 되어있는 상태로 전달해주세요.';
  for (const rr of [1, 2, 3, 4, 5, 6]) ws.getRow(rr).height = 15;

  // 헤더 (7행) — O/Q는 굵게+강조채움
  const hr = ws.getRow(7); hr.height = 15;
  HEADERS.forEach((h, i) => {
    const cell = hr.getCell(i + 1);
    cell.value = h; cell.alignment = { horizontal: 'center' };
    const accent = (i + 1 === 15 || i + 1 === 17);
    cell.font = accent ? { ...FONT, bold: true } : { ...FONT };
    if (accent) cell.fill = FILL;
  });

  // 데이터 (8행~): 거래처별 이월 + 누계
  let r = 8, seq = 1;
  for (const c of clients) {
    const cols = computeCols(c, todayISO);
    const biz = c.business_type || '';

    const carry = ws.getRow(r++);
    carry.getCell(1).value = seq++; carry.getCell(2).value = c.client_code; carry.getCell(3).value = c.client_name;
    carry.getCell(5).value = '이월';
    carry.getCell(6).value = 0; carry.getCell(7).value = 0; carry.getCell(8).value = 0; carry.getCell(9).value = 0;
    carry.getCell(10).value = c.net_close;
    carry.getCell(11).value = biz; carry.getCell(12).value = c.client_name; carry.getCell(13).value = dept; carry.getCell(14).value = manager;
    styleRow(carry);

    const total = ws.getRow(r++);
    total.getCell(1).value = seq++; total.getCell(2).value = c.client_code; total.getCell(3).value = c.client_name;
    total.getCell(5).value = '누계';
    total.getCell(6).value = c.period_supply; total.getCell(7).value = c.period_tax;
    total.getCell(8).value = c.period_total; total.getCell(9).value = c.period_payment;
    total.getCell(10).value = c.net_now;
    total.getCell(11).value = biz; total.getCell(12).value = c.client_name; total.getCell(13).value = dept; total.getCell(14).value = manager;
    if (cols.expected != null) total.getCell(15).value = cols.expected;
    if (cols.remain != null) total.getCell(16).value = cols.remain;
    if (cols.dueDate != null) total.getCell(17).value = cols.dueDate;
    styleRow(total);
  }

  // 컬럼 필터 (헤더 7행 ~ 마지막 데이터행)
  const lastRow = Math.max(7, r - 1);
  ws.autoFilter = `A7:R${lastRow}`;
}

export async function buildScheduleXlsx(
  wineClients: ScheduleClient[], glassClients: ScheduleClient[], todayISO: string, manager: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  addSheet(wb, '수금일정표양식CD', wineClients, todayISO, '영업1부', manager);
  addSheet(wb, '수금일정표양식DL', glassClients, todayISO, '영업1부', manager);
  return (await wb.xlsx.writeBuffer()) as Buffer;
}
