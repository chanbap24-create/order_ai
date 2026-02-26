import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

// ─── 데이터 조회 (ledger route.ts와 동일 로직) ───
export async function fetchLedgerData(clientCode: string, startDate: string, endDate: string, clientType: string) {
  const table = clientType === 'glass' ? 'glass_shipments' : 'shipments';
  const payTable = clientType === 'glass' ? 'glass_payments' : 'payments';
  const carryoverTable = clientType === 'glass' ? 'glass_client_carryover' : 'client_carryover';
  const batch = 1000;

  const isGlass = clientType === 'glass';

  // 거래처 정보
  const { data: clientInfo } = isGlass
    ? await supabase.from('glass_client_carryover').select('client_code, client_name, carryover_amount').eq('client_code', clientCode).single()
    : await supabase.from('client_details').select('client_code, client_name, client_type, manager').eq('client_code', clientCode).single();

  const clientName = clientInfo?.client_name || '';

  // 같은 거래처명의 모든 코드
  const allCodes: string[] = [clientCode];
  if (clientName) {
    const detailTable = isGlass ? 'glass_client_carryover' : 'client_details';
    const { data: siblings } = await supabase.from(detailTable).select('client_code').eq('client_name', clientName);
    if (siblings) for (const s of siblings) if (!allCodes.includes(s.client_code)) allCodes.push(s.client_code);
  }

  // 출고 조회
  const allRows: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from(table)
      .select('ship_date, item_no, item_name, quantity, unit_price, supply_amount, tax_amount, total_amount, manager, warehouse, client_code, client_name')
      .in('client_code', allCodes).gte('ship_date', startDate).lte('ship_date', endDate)
      .order('ship_date', { ascending: true }).order('item_name', { ascending: true })
      .range(from, from + batch - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < batch) break;
    from += batch;
  }

  // 이름 기반 추가 조회
  if (clientName) {
    let nameFrom = 0;
    while (true) {
      const { data, error } = await supabase.from(table)
        .select('ship_date, item_no, item_name, quantity, unit_price, supply_amount, tax_amount, total_amount, manager, warehouse, client_code, client_name')
        .eq('client_name', clientName).not('client_code', 'in', `(${allCodes.join(',')})`)
        .gte('ship_date', startDate).lte('ship_date', endDate)
        .order('ship_date', { ascending: true }).range(nameFrom, nameFrom + batch - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allRows.push(...data);
      if (data.length < batch) break;
      nameFrom += batch;
    }
    allRows.sort((a, b) => a.ship_date.localeCompare(b.ship_date) || (a.item_name || '').localeCompare(b.item_name || ''));
  }

  // 이월 미수금
  let carryover = 0;
  const { data: co } = await supabase.from(carryoverTable).select('carryover_amount').in('client_code', allCodes);
  if (co) for (const c of co) carryover += (c.carryover_amount || 0);
  if (clientName) {
    const { data: coName } = await supabase.from(carryoverTable).select('carryover_amount')
      .eq('client_name', clientName).not('client_code', 'in', `(${allCodes.join(',')})`);
    if (coName) for (const c of coName) carryover += (c.carryover_amount || 0);
  }

  // 이전 판매액 (CUTOFF 이후)
  const CUTOFF = '2025-08-01';
  let prevSales = 0;
  let pf = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select('total_amount')
      .in('client_code', allCodes).gte('ship_date', CUTOFF).lt('ship_date', startDate)
      .range(pf, pf + batch - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) prevSales += (r.total_amount || 0);
    if (data.length < batch) break;
    pf += batch;
  }

  // 이전 수금
  let prevPay = 0;
  let ppf = 0;
  while (true) {
    const { data, error } = await supabase.from(payTable).select('amount')
      .in('client_code', allCodes).lt('payment_date', startDate)
      .range(ppf, ppf + batch - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) prevPay += (r.amount || 0);
    if (data.length < batch) break;
    ppf += batch;
  }

  const prevBalance = carryover + prevSales - prevPay;

  // 수금 내역
  const payments: any[] = [];
  let payFrom = 0;
  while (true) {
    const { data, error } = await supabase.from(payTable)
      .select('client_code, client_name, payment_date, amount')
      .in('client_code', allCodes).gte('payment_date', startDate).lte('payment_date', endDate)
      .order('payment_date', { ascending: true }).range(payFrom, payFrom + batch - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    payments.push(...data);
    if (data.length < batch) break;
    payFrom += batch;
  }

  // 이름 기반 수금
  if (clientName) {
    let npf = 0;
    while (true) {
      const { data, error } = await supabase.from(payTable)
        .select('client_code, client_name, payment_date, amount')
        .eq('client_name', clientName).not('client_code', 'in', `(${allCodes.join(',')})`)
        .gte('payment_date', startDate).lte('payment_date', endDate)
        .order('payment_date', { ascending: true }).range(npf, npf + batch - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      payments.push(...data);
      if (data.length < batch) break;
      npf += batch;
    }
  }

  return { client: clientInfo || { client_code: clientCode, client_name: clientCode }, rows: allRows, payments, prevBalance };
}

// ─── 데이터 그룹화 ───
export interface GroupedDay { date: string; shipRows: any[]; payRows: any[]; totals: { qty: number; supply: number; tax: number; total: number; payment: number } }
export interface GroupedMonth { month: string; days: GroupedDay[]; totals: { qty: number; supply: number; tax: number; total: number; payment: number } }

export function groupData(rows: any[], payments: any[]): GroupedMonth[] {
  const payByDay = new Map<string, any[]>();
  for (const p of payments) {
    const d = p.payment_date.slice(0, 10);
    if (!payByDay.has(d)) payByDay.set(d, []);
    payByDay.get(d)!.push(p);
  }

  const monthMap = new Map<string, Map<string, { rows: any[]; pays: any[] }>>();
  for (const r of rows) {
    const m = r.ship_date.slice(0, 7), d = r.ship_date.slice(0, 10);
    if (!monthMap.has(m)) monthMap.set(m, new Map());
    const dm = monthMap.get(m)!;
    if (!dm.has(d)) dm.set(d, { rows: [], pays: [] });
    dm.get(d)!.rows.push(r);
  }
  for (const [d, pays] of payByDay) {
    const m = d.slice(0, 7);
    if (!monthMap.has(m)) monthMap.set(m, new Map());
    const dm = monthMap.get(m)!;
    if (!dm.has(d)) dm.set(d, { rows: [], pays: [] });
    dm.get(d)!.pays = pays;
  }

  const result: GroupedMonth[] = [];
  for (const [m, dayMap] of monthMap) {
    const days: GroupedDay[] = [];
    const mt = { qty: 0, supply: 0, tax: 0, total: 0, payment: 0 };
    const sorted = [...dayMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [d, { rows: dr, pays }] of sorted) {
      const dt = { qty: 0, supply: 0, tax: 0, total: 0, payment: 0 };
      for (const r of dr) { dt.qty += r.quantity || 0; dt.supply += r.supply_amount || 0; dt.tax += r.tax_amount || 0; dt.total += r.total_amount || 0; }
      for (const p of pays) { dt.payment += p.amount || 0; }
      mt.qty += dt.qty; mt.supply += dt.supply; mt.tax += dt.tax; mt.total += dt.total; mt.payment += dt.payment;
      days.push({ date: d, shipRows: dr, payRows: pays, totals: dt });
    }
    result.push({ month: m, days, totals: mt });
  }
  result.sort((a, b) => a.month.localeCompare(b.month));
  return result;
}

const fmt = (n: number) => n.toLocaleString('ko-KR');

// ─── Excel 생성 ───
export async function generateExcel(client: any, grouped: GroupedMonth[], prevBalance: number, startDate: string, endDate: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('매출처원장');

  // 컬럼 설정
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

  for (const month of grouped) {
    for (const day of month.days) {
      // 출고 행
      for (let i = 0; i < day.shipRows.length; i++) {
        const r = day.shipRows[i];
        const row = ws.getRow(rowIdx++);
        row.values = [i === 0 ? day.date.slice(5) : '', r.item_name, r.quantity, r.unit_price, r.supply_amount, r.tax_amount, r.total_amount, '', ''];
        row.getCell(3).numFmt = numFmt; row.getCell(4).numFmt = numFmt;
        row.getCell(5).numFmt = numFmt; row.getCell(6).numFmt = numFmt; row.getCell(7).numFmt = numFmt;
        row.font = { size: 9 };
      }
      // 입금 행
      for (let i = 0; i < day.payRows.length; i++) {
        const p = day.payRows[i];
        const row = ws.getRow(rowIdx++);
        row.values = [day.shipRows.length === 0 && i === 0 ? day.date.slice(5) : '', '입금', '', '', '', '', '', p.amount, ''];
        row.getCell(8).numFmt = numFmt;
        row.getCell(2).font = { size: 9, color: { argb: 'FF1565C0' }, bold: true };
        row.getCell(8).font = { size: 9, color: { argb: 'FF1565C0' }, bold: true };
        row.font = { size: 9 };
      }
      // 일계
      if (day.shipRows.length > 1 || day.payRows.length > 0) {
        runBal += day.totals.total - day.totals.payment;
        const row = ws.getRow(rowIdx++);
        row.values = [`${day.date.slice(5)} 일계`, '', day.totals.qty, '', day.totals.supply, day.totals.tax, day.totals.total, day.totals.payment || '', runBal];
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
    grandTot.tax += month.totals.tax; grandTot.total += month.totals.total; grandTot.payment += month.totals.payment;
    const mrow = ws.getRow(rowIdx++);
    mrow.values = [`${month.month} 월계`, '', month.totals.qty, '', month.totals.supply, month.totals.tax, month.totals.total, month.totals.payment || '', runBal];
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
  trow.values = [`[${client.client_name} 합계]`, '', grandTot.qty, '', grandTot.supply, grandTot.tax, grandTot.total, grandTot.payment, finalBal];
  trow.font = { size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  trow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5A1515' } };
  for (let c = 1; c <= 9; c++) trow.getCell(c).font = { size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  trow.getCell(3).numFmt = numFmt; trow.getCell(5).numFmt = numFmt; trow.getCell(6).numFmt = numFmt;
  trow.getCell(7).numFmt = numFmt; trow.getCell(8).numFmt = numFmt; trow.getCell(9).numFmt = numFmt;

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

// ─── PDF 생성 ───
export async function generatePDF(client: any, grouped: GroupedMonth[], prevBalance: number, startDate: string, endDate: string): Promise<Buffer> {
  const fontDir = path.join(process.cwd(), 'public', 'fonts');
  const regularFont = path.join(fontDir, 'NanumGothic-Regular.ttf');
  const boldFont = path.join(fontDir, 'NanumGothic-Bold.ttf');
  const hasRegular = fs.existsSync(regularFont);
  const hasBold = fs.existsSync(boldFont);

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  if (hasRegular) doc.registerFont('Ko', regularFont);
  if (hasBold) doc.registerFont('KoBold', boldFont);
  const font = hasRegular ? 'Ko' : 'Helvetica';
  const fontB = hasBold ? 'KoBold' : 'Helvetica-Bold';

  const f = (n: number) => n.toLocaleString('ko-KR');
  const pageW = 842 - 60; // A4 landscape - margins
  const cols = [52, 180, 40, 60, 75, 60, 75, 75, 75]; // 9 columns
  const headers = ['일자', '품목명', '수량', '단가', '공급금액', '부가세', '합계', '수금액', '미수액'];
  const rowH = 14;
  let y = 30;

  const drawHeader = () => {
    y = 30;
    doc.font(fontB).fontSize(12).fillColor('#2c1810')
      .text(`매출처원장 - ${client.client_name} (${client.client_code})`, 30, y);
    y += 18;
    doc.font(font).fontSize(8).fillColor('#888888')
      .text(`${startDate} ~ ${endDate}`, 30, y);
    y += 14;
    if (prevBalance) {
      doc.font(fontB).fontSize(8).fillColor('#5A1515')
        .text(`이월잔액: ${f(prevBalance)}원`, 30, y);
      y += 14;
    }
    // table header
    doc.rect(30, y, pageW, rowH + 4).fill('#f5f0f0');
    let x = 30;
    doc.font(fontB).fontSize(7).fillColor('#5A1515');
    for (let i = 0; i < 9; i++) {
      const align = i <= 1 ? 'left' : 'right';
      doc.text(headers[i], x + 2, y + 3, { width: cols[i] - 4, align });
      x += cols[i];
    }
    y += rowH + 4;
    doc.moveTo(30, y).lineTo(30 + pageW, y).strokeColor('#5A1515').lineWidth(1.5).stroke();
    y += 2;
  };

  const checkPage = (need: number) => {
    if (y + need > 560) { doc.addPage(); drawHeader(); }
  };

  const drawRow = (vals: string[], opts?: { bg?: string; color?: string; bold?: boolean; payColor?: boolean; balColor?: boolean }) => {
    checkPage(rowH);
    if (opts?.bg) { doc.rect(30, y, pageW, rowH).fill(opts.bg); }
    let x = 30;
    const f_ = opts?.bold ? fontB : font;
    const c_ = opts?.color || '#000000';
    for (let i = 0; i < 9; i++) {
      const align = i <= 1 ? 'left' : 'right';
      let color = c_;
      if (opts?.payColor && i === 7 && vals[7]) color = '#1565C0';
      if (opts?.balColor && i === 8 && vals[8]) color = '#c62828';
      doc.font(f_).fontSize(7).fillColor(color)
        .text(vals[i] || '', x + 2, y + 3, { width: cols[i] - 4, align });
      x += cols[i];
    }
    y += rowH;
  };

  drawHeader();

  let runBal = prevBalance;
  const gTot = { qty: 0, supply: 0, tax: 0, total: 0, payment: 0 };

  for (const month of grouped) {
    for (const day of month.days) {
      for (let i = 0; i < day.shipRows.length; i++) {
        const r = day.shipRows[i];
        drawRow([i === 0 ? day.date.slice(5) : '', r.item_name || '', f(r.quantity), f(r.unit_price), f(r.supply_amount), f(r.tax_amount), f(r.total_amount), '', '']);
      }
      for (let i = 0; i < day.payRows.length; i++) {
        const p = day.payRows[i];
        drawRow([day.shipRows.length === 0 && i === 0 ? day.date.slice(5) : '', '입금', '', '', '', '', '', f(p.amount), ''], { payColor: true });
      }
      runBal += day.totals.total - day.totals.payment;
      if (day.shipRows.length > 1 || day.payRows.length > 0) {
        drawRow([`${day.date.slice(5)} 일계`, '', f(day.totals.qty), '', f(day.totals.supply), f(day.totals.tax), f(day.totals.total), day.totals.payment ? f(day.totals.payment) : '', f(runBal)],
          { bg: '#faf8f6', bold: true, payColor: true, balColor: true });
      }
    }
    gTot.qty += month.totals.qty; gTot.supply += month.totals.supply;
    gTot.tax += month.totals.tax; gTot.total += month.totals.total; gTot.payment += month.totals.payment;
    drawRow([`${month.month} 월계`, '', f(month.totals.qty), '', f(month.totals.supply), f(month.totals.tax), f(month.totals.total), month.totals.payment ? f(month.totals.payment) : '', f(runBal)],
      { bg: '#fff8e1', bold: true, color: '#5A1515', payColor: true, balColor: true });
  }

  const finalBal = prevBalance + gTot.total - gTot.payment;
  drawRow([`${client.client_name} 합계`, '', f(gTot.qty), '', f(gTot.supply), f(gTot.tax), f(gTot.total), f(gTot.payment), f(finalBal)],
    { bg: '#5A1515', bold: true, color: '#ffffff' });

  doc.end();
  return new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// ─── GET 핸들러 ───
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientCode = searchParams.get('client_code');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const clientType = searchParams.get('type') || 'wine';
    const format = searchParams.get('format') || 'excel';

    if (!clientCode || !startDate || !endDate) {
      return NextResponse.json({ error: 'client_code, start_date, end_date required' }, { status: 400 });
    }

    const { client, rows, payments, prevBalance } = await fetchLedgerData(clientCode, startDate, endDate, clientType);
    const grouped = groupData(rows, payments);
    const safeName = (client.client_name || clientCode).replace(/[\\/:*?"<>|]/g, '_');

    if (format === 'pdf') {
      const buf = await generatePDF(client, grouped, prevBalance, startDate, endDate);
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`매출처원장_${safeName}_${startDate}.pdf`)}`,
        },
      });
    }

    const buf = await generateExcel(client, grouped, prevBalance, startDate, endDate);
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`매출처원장_${safeName}_${startDate}.xlsx`)}`,
      },
    });
  } catch (err) {
    console.error('Ledger export error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
