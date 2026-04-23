import ExcelJS from 'exceljs';
import type { GroupedMonth } from './groupData';

/**
 * ExcelJS 기반 매출처원장 워크북 생성.
 * 헤더 / 전월미수 / 일·월·총합계 스타일 처리.
 */
export async function generateExcel(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  grouped: GroupedMonth[],
  prevBalance: number,
  startDate: string,
  endDate: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('매출처원장');

  ws.columns = [
    { header: '일자', key: 'date', width: 12 },
    { header: '품목명', key: 'item', width: 30 },
    { header: '수량', key: 'qty', width: 8 },
    { header: '단가', key: 'price', width: 12 },
    { header: '공급금액', key: 'supply', width: 14 },
    { header: '부가세', key: 'tax', width: 12 },
    { header: '합계', key: 'total', width: 14 },
    { header: '수금액', key: 'payment', width: 14 },
    { header: '미수액', key: 'balance', width: 14 },
  ];

  // 타이틀
  ws.spliceRows(1, 0, []);
  ws.getCell('A1').value = `매출처원장 - ${client.client_name} (${client.client_code})`;
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.mergeCells('A1:I1');
  ws.getCell('A2').value = `기간: ${startDate} ~ ${endDate}`;
  ws.getCell('A2').font = { size: 10, color: { argb: 'FF888888' } };
  ws.mergeCells('A2:I2');

  // 헤더 스타일
  const headerRow = ws.getRow(3);
  headerRow.values = ['일자', '품목명', '수량', '단가', '공급금액', '부가세', '합계', '수금액', '미수액'];
  headerRow.font = { bold: true, size: 10 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F0F0' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 22;
  for (let c = 1; c <= 9; c++) {
    headerRow.getCell(c).border = { bottom: { style: 'medium', color: { argb: 'FF5A1515' } } };
  }

  let rowIdx = 4;
  let runBal = prevBalance;
  const numFmt = '#,##0';
  const grandTot = { qty: 0, supply: 0, tax: 0, total: 0, payment: 0 };

  // 전월미수 행
  const prevRow = ws.getRow(rowIdx++);
  prevRow.values = ['', '전월미수', '', '', '', '', '', '', prevBalance];
  prevRow.getCell(2).font = { size: 10, bold: true, color: { argb: 'FF5A1515' } };
  prevRow.getCell(9).numFmt = numFmt;
  prevRow.getCell(9).font = { size: 10, bold: true, color: { argb: prevBalance > 0 ? 'FFC62828' : 'FF2c1810' } };

  for (const month of grouped) {
    for (const day of month.days) {
      // 출고 행
      for (let i = 0; i < day.shipRows.length; i++) {
        const r = day.shipRows[i];
        const row = ws.getRow(rowIdx++);
        row.values = [
          i === 0 ? day.date.slice(5) : '',
          r.item_name, r.quantity, r.selling_price ?? r.unit_price,
          r.supply_amount, r.tax_amount, r.total_amount, '', '',
        ];
        row.getCell(3).numFmt = numFmt; row.getCell(4).numFmt = numFmt;
        row.getCell(5).numFmt = numFmt; row.getCell(6).numFmt = numFmt; row.getCell(7).numFmt = numFmt;
        row.font = { size: 9 };
      }
      // 입금 행
      for (let i = 0; i < day.payRows.length; i++) {
        const p = day.payRows[i];
        const row = ws.getRow(rowIdx++);
        row.values = [
          day.shipRows.length === 0 && i === 0 ? day.date.slice(5) : '',
          '입금', '', '', '', '', '', p.amount, '',
        ];
        row.getCell(8).numFmt = numFmt;
        row.getCell(2).font = { size: 9, color: { argb: 'FF1565C0' }, bold: true };
        row.getCell(8).font = { size: 9, color: { argb: 'FF1565C0' }, bold: true };
        row.font = { size: 9 };
      }
      // 일계
      if (day.shipRows.length > 1 || day.payRows.length > 0) {
        runBal += day.totals.total - day.totals.payment;
        const row = ws.getRow(rowIdx++);
        row.values = [
          `${day.date.slice(5)} 일계`, '',
          day.totals.qty, '', day.totals.supply, day.totals.tax, day.totals.total,
          day.totals.payment || '', runBal,
        ];
        row.font = { size: 9, bold: true };
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAF8F6' } };
        row.getCell(3).numFmt = numFmt; row.getCell(5).numFmt = numFmt; row.getCell(6).numFmt = numFmt;
        row.getCell(7).numFmt = numFmt; row.getCell(8).numFmt = numFmt; row.getCell(9).numFmt = numFmt;
        row.getCell(9).font = { size: 9, bold: true, color: { argb: 'FFC62828' } };
        if (day.totals.payment) row.getCell(8).font = { size: 9, bold: true, color: { argb: 'FF1565C0' } };
      } else {
        runBal += day.totals.total - day.totals.payment;
      }
    }
    // 월계
    grandTot.qty += month.totals.qty; grandTot.supply += month.totals.supply;
    grandTot.tax += month.totals.tax; grandTot.total += month.totals.total;
    grandTot.payment += month.totals.payment;
    const mrow = ws.getRow(rowIdx++);
    mrow.values = [
      `${month.month} 월계`, '',
      month.totals.qty, '', month.totals.supply, month.totals.tax, month.totals.total,
      month.totals.payment || '', runBal,
    ];
    mrow.font = { size: 10, bold: true, color: { argb: 'FF5A1515' } };
    mrow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
    mrow.getCell(3).numFmt = numFmt; mrow.getCell(5).numFmt = numFmt; mrow.getCell(6).numFmt = numFmt;
    mrow.getCell(7).numFmt = numFmt; mrow.getCell(8).numFmt = numFmt; mrow.getCell(9).numFmt = numFmt;
    mrow.getCell(9).font = { size: 10, bold: true, color: { argb: 'FFC62828' } };
    if (month.totals.payment) mrow.getCell(8).font = { size: 10, bold: true, color: { argb: 'FF1565C0' } };
  }

  // 총합계
  const finalBal = prevBalance + grandTot.total - grandTot.payment;
  const trow = ws.getRow(rowIdx++);
  trow.values = [
    `[${client.client_name} 합계]`, '',
    grandTot.qty, '', grandTot.supply, grandTot.tax, grandTot.total, grandTot.payment, finalBal,
  ];
  trow.font = { size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  trow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5A1515' } };
  for (let c = 1; c <= 9; c++) trow.getCell(c).font = { size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  trow.getCell(3).numFmt = numFmt; trow.getCell(5).numFmt = numFmt; trow.getCell(6).numFmt = numFmt;
  trow.getCell(7).numFmt = numFmt; trow.getCell(8).numFmt = numFmt; trow.getCell(9).numFmt = numFmt;

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
