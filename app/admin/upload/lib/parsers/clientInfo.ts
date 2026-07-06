// 거래처정보(ERP 명부) 파서 — 브라우저에서 xlsx 파싱.
// 헤더명으로 열을 찾아 매핑. 요청대로 N/P/X/Z(사업자등록번호·대표자·전화번호·이메일)는 가져오지 않음.
// 주소 = 납품주소 우선, 없으면 사업장소재지.
import * as XLSX from "xlsx";

export interface ClientInfoRow {
  client_code: string;
  client_name: string;
  business_type: string; // 업종구분
  manager: string;       // 영업담당자
  contact_name: string;  // 업체담당자
  address: string;       // 납품주소 || 사업장소재지
  status: string;        // 상태 (정상/폐업/휴업/사용안함) — order 검색 노출 필터용
}

// "  -  " 같은 대시/공백만인 값은 빈값 취급.
const clean = (v: unknown): string => {
  const t = String(v ?? "").trim();
  return /^[-\s]*$/.test(t) ? "" : t;
};

export async function parseClientInfoFile(file: File): Promise<ClientInfoRow[]> {
  const wb = XLSX.read(await file.arrayBuffer());
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
  if (rows.length < 2) return [];

  const header = (rows[0] as unknown[]).map((h) => String(h ?? "").trim());
  const col = (name: string) => header.findIndex((h) => h === name);
  const iCode = col("거래처번호");
  const iName = col("거래처명");
  const iBiz = col("업종구분");
  const iMgr = col("영업담당자");
  const iContact = col("업체담당자");
  const iDeliv = col("납품주소");
  const iLoc = col("사업장소재지");
  const iStatus = col("상태");
  if (iCode < 0 || iName < 0) {
    throw new Error("거래처정보 파일이 아닙니다 — '거래처번호'/'거래처명' 열을 찾을 수 없습니다.");
  }

  const out: ClientInfoRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    const code = clean(row[iCode]);
    if (!code) continue;
    out.push({
      client_code: code,
      client_name: clean(row[iName]),
      business_type: iBiz >= 0 ? clean(row[iBiz]) : "",
      manager: iMgr >= 0 ? clean(row[iMgr]) : "",
      contact_name: iContact >= 0 ? clean(row[iContact]) : "",
      address: (iDeliv >= 0 ? clean(row[iDeliv]) : "") || (iLoc >= 0 ? clean(row[iLoc]) : ""),
      status: iStatus >= 0 ? clean(row[iStatus]) : "",
    });
  }
  return out;
}
