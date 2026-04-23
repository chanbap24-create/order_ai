type PaymentRow = {
  client_code: string;
  client_name: string;
  payment_date: string;
  amount: number;
  manager: string;
  department: string;
};

type CarryoverRow = {
  client_code: string;
  client_name: string;
  carryover_amount: number;
};

export type ParsedPayments = {
  payments: PaymentRow[];
  carryovers: CarryoverRow[];
};

const toDate = (v: unknown): string | null => {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const d = new Date((v - 25569) * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(s)) return s.replace(/\//g, "-");
  return null;
};

/**
 * 수금내역 엑셀 파싱.
 * - 이월행: 거래처 정보 갱신 + carryover 추출
 * - 일계행: 수금액 추출 (음수=환불 포함)
 */
export async function parsePaymentsFile(file: File): Promise<ParsedPayments> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

  let currentCode = "";
  let currentName = "";
  let currentManager = "";
  let currentDept = "";
  const payments: PaymentRow[] = [];
  const carryovers: CarryoverRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    if (r[4] === "이월" && r[1]) {
      currentCode = String(r[1]).trim().replace(/\.0$/, "");
      currentName = String(r[2] || "").trim();
      currentDept = String(r[12] || "").trim();
      currentManager = String(r[13] || "").trim();
      carryovers.push({
        client_code: currentCode,
        client_name: currentName,
        carryover_amount: Math.round(Number(r[9]) || 0),
      });
    }
    if (r[4] === "일계" && r[8] && Number(r[8]) !== 0) {
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

  return { payments, carryovers };
}
