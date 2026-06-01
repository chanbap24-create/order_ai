import ExcelJS from 'exceljs';
import { computeCols, type ScheduleClient } from './compute';

// 수금일정표 양식 1개 시트 작성 (원본과 동일한 열너비/숨김열/행높이/서식).
const WIDTHS = [8.29, 16.71, 25, 16.71, 10, 13.29, 13.29, 13.29, 13.29, 13.29, 13.29, 25, 21.71, 10, 12.71, 11.29, 10, 8.86, 8.86];
const HIDDEN = new Set([6, 7, 8, 9, 11, 12, 13, 14]);
const HEADERS = ['순번', '판매처번호', '판매처', '일자', '구분', '공급가액', '세액', '판매액', '수금액', '미수금', '업종구분', '대표거래처', '부서', '담당자', '입금예정금액', '미수잔액', '입금예정일', '비고'];
const FONT = { name: '맑은 고딕', size: 10 } as const;
const MONEY = '#,##0';

function styleRow(row: ExcelJS.Row) {
  for (let c = 1; c <= 18; c++) {
    const cell = row.getCell(c);
    cell.font = { ...FONT };
    if ([6, 7, 8, 9, 10, 15, 16].includes(c)) cell.numFmt = MONEY;
    if (c === 17) cell.numFmt = 'yyyy-mm-dd';
  }
}

function addSheet(wb: ExcelJS.Workbook, name: string, clients: ScheduleClient[], todayISO: string, dept: string, manager: string) {
  const ws = wb.addWorksheet(name, { views: [{ zoomScale: 97 }] });
  ws.properties.defaultRowHeight = 15;
  WIDTHS.forEach((w, i) => { const col = ws.getColumn(i + 1); col.width = w; if (HIDDEN.has(i + 1)) col.hidden = true; });

  // 안내문 (원본 1~4행)
  ws.getCell('R1').value = '노란색 표시:'; ws.getCell('S1').value = 'OFF';
  ws.getCell('O2').value = '** 미수잔액 : 현미수 - 입금예정금액 수식 걸려있음 ';
  ws.getCell('O3').value = '** 결제예정일 : 날짜 양식으로 통일 (ex. 2026-03-03)';
  ws.getCell('O4').value = '** 필요없는 항목들은 숨기기 되어있습니다. 숨기기 되어있는 상태로 전달해주세요.';

  // 헤더 (7행)
  const hr = ws.getRow(7);
  HEADERS.forEach((h, i) => {
    const cell = hr.getCell(i + 1);
    cell.value = h; cell.font = { ...FONT }; cell.alignment = { horizontal: 'center' };
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
    total.getCell(6).value = 0; total.getCell(7).value = 0; total.getCell(8).value = 0; total.getCell(9).value = 0;
    total.getCell(10).value = c.net_now;
    total.getCell(11).value = biz; total.getCell(12).value = c.client_name; total.getCell(13).value = dept; total.getCell(14).value = manager;
    if (cols.expected != null) total.getCell(15).value = cols.expected;
    if (cols.remain != null) total.getCell(16).value = cols.remain;
    if (cols.dueDate != null) total.getCell(17).value = cols.dueDate;
    styleRow(total);
  }
}

export async function buildScheduleXlsx(
  wineClients: ScheduleClient[], glassClients: ScheduleClient[], todayISO: string, manager: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  addSheet(wb, '수금일정표양식CD', wineClients, todayISO, '영업1부', manager);
  addSheet(wb, '수금일정표양식DL', glassClients, todayISO, '영업1부', manager);
  return (await wb.xlsx.writeBuffer()) as Buffer;
}
