import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import subsetFont from 'subset-font';
import path from 'path';
import fs from 'fs';
import type { GroupedMonth } from './groupData';

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  return rgb(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  );
}

/**
 * PDF-lib 기반 매출처원장 PDF 생성.
 * 한글 폰트(NanumGothic) subset → 임베드. 실패 시 원본 → 최종 Helvetica fallback.
 */
export async function generatePDF(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  grouped: GroupedMonth[],
  prevBalance: number,
  startDate: string,
  endDate: string,
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const allTextSet = new Set<string>();
  const addText = (s: string) => { for (const ch of s) allTextSet.add(ch); };
  const f0 = (n: number) => n.toLocaleString('ko-KR');

  addText(`매출처원장 - ${client.client_name} (${client.client_code})`);
  addText(`${startDate} ~ ${endDate}`);
  addText('일자품목명수량단가공급금액부가세합계수금액미수액');
  addText(`${client.client_name} 합계`);
  addText('입금 월계 일계 전월미수 0123456789,-.');
  addText(f0(prevBalance));

  for (const month of grouped) {
    addText(`${month.month} 월계`);
    for (const day of month.days) {
      addText(day.date);
      addText(`${day.date.slice(5)} 일계`);
      for (const r of day.shipRows) {
        addText(r.item_name || '');
        addText(f0(r.quantity)); addText(f0(r.selling_price ?? r.unit_price));
        addText(f0(r.supply_amount)); addText(f0(r.tax_amount)); addText(f0(r.total_amount));
      }
      for (const p of day.payRows) { addText(f0(p.amount)); }
      addText(f0(day.totals.qty)); addText(f0(day.totals.supply)); addText(f0(day.totals.tax));
      addText(f0(day.totals.total)); addText(f0(day.totals.payment));
    }
    addText(f0(month.totals.qty)); addText(f0(month.totals.supply)); addText(f0(month.totals.tax));
    addText(f0(month.totals.total)); addText(f0(month.totals.payment));
  }

  const subsetText = Array.from(allTextSet).join('');

  // 한글 폰트 로드
  const fontDir = path.join(process.cwd(), 'public', 'fonts');
  let koFont: PDFFont, koBoldFont: PDFFont;
  try {
    const regularBytes = fs.readFileSync(path.join(fontDir, 'NanumGothic-Regular.ttf'));
    const boldBytes = fs.readFileSync(path.join(fontDir, 'NanumGothic-Bold.ttf'));
    let regEmbed: Buffer | Uint8Array = regularBytes;
    let boldEmbed: Buffer | Uint8Array = boldBytes;
    try {
      regEmbed = Buffer.from(await subsetFont(regularBytes, subsetText, { targetFormat: 'truetype' }));
      boldEmbed = Buffer.from(await subsetFont(boldBytes, subsetText, { targetFormat: 'truetype' }));
    } catch { /* subset 실패 시 원본 사용 */ }
    koFont = await doc.embedFont(regEmbed);
    koBoldFont = await doc.embedFont(boldEmbed);
  } catch {
    koFont = await doc.embedFont(StandardFonts.Helvetica);
    koBoldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  }

  const f = (n: number) => n.toLocaleString('ko-KR');
  const M = 30;
  const pageW = 842, pageH = 595; // A4 landscape
  const tableW = pageW - M * 2;
  const cols = [52, 178, 40, 60, 75, 60, 75, 75, 75];
  const headers = ['일자', '품목명', '수량', '단가', '공급금액', '부가세', '합계', '수금액', '미수액'];
  const rowH = 14;
  let page: PDFPage;
  let y: number;

  const addNewPage = () => {
    page = doc.addPage([pageW, pageH]);
    y = pageH - M;
  };

  const drawPageHeader = () => {
    page.drawText(`매출처원장 - ${client.client_name} (${client.client_code})`, {
      x: M, y, size: 12, font: koBoldFont, color: hexToRgb('#2c1810'),
    });
    y -= 16;
    page.drawText(`${startDate} ~ ${endDate}`, { x: M, y, size: 8, font: koFont, color: hexToRgb('#888888') });
    y -= 12;
    page.drawRectangle({ x: M, y: y - rowH, width: tableW, height: rowH, color: hexToRgb('#f5f0f0') });
    let x = M;
    for (let i = 0; i < 9; i++) {
      const txt = headers[i];
      const tw = koBoldFont.widthOfTextAtSize(txt, 7);
      const tx = i <= 1 ? x + 2 : x + cols[i] - 4 - tw;
      page.drawText(txt, { x: tx, y: y - rowH + 4, size: 7, font: koBoldFont, color: hexToRgb('#5A1515') });
      x += cols[i];
    }
    y -= rowH;
    page.drawLine({ start: { x: M, y }, end: { x: M + tableW, y }, thickness: 1.5, color: hexToRgb('#5A1515') });
    y -= 2;
  };

  const ensureSpace = (need: number) => {
    if (y - need < M) { addNewPage(); drawPageHeader(); }
  };

  const drawRow = (
    vals: string[],
    opts?: { bg?: string; color?: string; bold?: boolean; payColor?: boolean; balColor?: boolean },
  ) => {
    ensureSpace(rowH);
    if (opts?.bg) {
      page.drawRectangle({ x: M, y: y - rowH, width: tableW, height: rowH, color: hexToRgb(opts.bg) });
    }
    const fn = opts?.bold ? koBoldFont : koFont;
    const defColor = opts?.color ? hexToRgb(opts.color) : rgb(0, 0, 0);
    let x = M;
    for (let i = 0; i < 9; i++) {
      const v = vals[i] || '';
      if (!v) { x += cols[i]; continue; }
      let color = defColor;
      if (opts?.payColor && i === 7) color = hexToRgb('#1565C0');
      if (opts?.balColor && i === 8) color = hexToRgb('#c62828');
      if (opts?.color === '#ffffff') color = rgb(1, 1, 1);
      const tw = fn.widthOfTextAtSize(v, 7);
      const tx = i <= 1 ? x + 2 : x + cols[i] - 4 - tw;
      page.drawText(v, { x: Math.max(tx, x + 1), y: y - rowH + 4, size: 7, font: fn, color });
      x += cols[i];
    }
    y -= rowH;
  };

  addNewPage();
  drawPageHeader();

  // 전월미수
  drawRow(
    ['', '전월미수', '', '', '', '', '', '', f(prevBalance)],
    { bold: true, balColor: prevBalance > 0 },
  );

  let runBal = prevBalance;
  const gTot = { qty: 0, supply: 0, tax: 0, total: 0, payment: 0 };

  for (const month of grouped) {
    for (const day of month.days) {
      for (let i = 0; i < day.shipRows.length; i++) {
        const r = day.shipRows[i];
        drawRow([
          i === 0 ? day.date.slice(5) : '',
          r.item_name || '',
          f(r.quantity), f(r.selling_price ?? r.unit_price),
          f(r.supply_amount), f(r.tax_amount), f(r.total_amount),
          '', '',
        ]);
      }
      for (let i = 0; i < day.payRows.length; i++) {
        const p = day.payRows[i];
        drawRow(
          [day.shipRows.length === 0 && i === 0 ? day.date.slice(5) : '', '입금', '', '', '', '', '', f(p.amount), ''],
          { payColor: true },
        );
      }
      runBal += day.totals.total - day.totals.payment;
      if (day.shipRows.length > 1 || day.payRows.length > 0) {
        drawRow(
          [`${day.date.slice(5)} 일계`, '',
            f(day.totals.qty), '',
            f(day.totals.supply), f(day.totals.tax), f(day.totals.total),
            day.totals.payment ? f(day.totals.payment) : '',
            f(runBal)],
          { bg: '#faf8f6', bold: true, payColor: true, balColor: true },
        );
      }
    }
    gTot.qty += month.totals.qty; gTot.supply += month.totals.supply;
    gTot.tax += month.totals.tax; gTot.total += month.totals.total; gTot.payment += month.totals.payment;
    drawRow(
      [`${month.month} 월계`, '',
        f(month.totals.qty), '',
        f(month.totals.supply), f(month.totals.tax), f(month.totals.total),
        month.totals.payment ? f(month.totals.payment) : '',
        f(runBal)],
      { bg: '#fff8e1', bold: true, color: '#5A1515', payColor: true, balColor: true },
    );
  }

  const finalBal = prevBalance + gTot.total - gTot.payment;
  drawRow(
    [`${client.client_name} 합계`, '',
      f(gTot.qty), '',
      f(gTot.supply), f(gTot.tax), f(gTot.total),
      f(gTot.payment), f(finalBal)],
    { bg: '#5A1515', bold: true, color: '#ffffff' },
  );

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
