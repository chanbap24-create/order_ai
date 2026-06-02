import type { DetectedType } from "../types";

type DetectResult = {
  type: DetectedType;
  confidence: "high" | "medium" | "low";
  reason: string;
};

/**
 * 엑셀 파일 내용으로 업로드 타입 자동 감지.
 * 헤더 + warehouse 값 + 파일명 힌트 + '이월' 행 여부로 판단.
 */
export async function detectFileType(file: File): Promise<DetectResult> {
  try {
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
    if (rows.length < 2) return { type: "unknown", confidence: "low", reason: "데이터 없음" };

    const headers = (rows[0] as unknown[]).map((h) => String(h ?? "").trim());
    const headerText = headers.join("|");
    const colCount = headers.filter((h) => h).length;

    // 1) 재고 파일
    if (
      headerText.includes("품번") &&
      headerText.includes("품명") &&
      (headerText.includes("재고수량") || headerText.includes("가용재고"))
    ) {
      if (headerText.includes("용마") || headerText.includes("보세(용마)")) {
        return { type: "downloads", confidence: "high", reason: "재고파일 - 용마 창고 헤더 감지 (CDV)" };
      }
      if (headerText.includes("GIG") || headerText.includes("보세(GIG)")) {
        return { type: "dl", confidence: "high", reason: "재고파일 - GIG 창고 헤더 감지 (DL)" };
      }
      return { type: "downloads", confidence: "low", reason: "재고파일이나 CDV/DL 구분 불가" };
    }

    // 2) 출고현황
    if (colCount >= 30) {
      // 1순위: 사업장(C열) — 까브드뱅=와인(CDV), 대유라이프=글라스(DL). 가장 명확한 신호.
      const bizCol = headers.findIndex((h) => h.includes("사업장"));
      if (bizCol >= 0) {
        const bizVals = new Set<string>();
        for (let i = 1; i < Math.min(100, rows.length); i++) {
          const v = String((rows[i] as unknown[])[bizCol] ?? "").trim();
          if (v) bizVals.add(v);
        }
        const bizText = Array.from(bizVals).join("|");
        if (bizText.includes("까브")) return { type: "client", confidence: "high", reason: "출고현황 - 사업장 까브드뱅 (CDV)" };
        if (bizText.includes("대유")) return { type: "dl-client", confidence: "high", reason: "출고현황 - 사업장 대유라이프 (DL)" };
      }

      // 2순위(fallback): 창고/위치 컬럼을 헤더명으로 찾는다 (ERP 컬럼 순서가 바뀌어도 안전). 못 찾으면 인덱스 23.
      const whCol = headers.findIndex((h) => h.includes("창고"));
      const whIdx = whCol >= 0 ? whCol : 23;
      const warehouseValues = new Set<string>();
      for (let i = 1; i < Math.min(100, rows.length); i++) {
        const r = rows[i] as unknown[];
        const wh = String(r[whIdx] ?? "").trim();
        if (wh) warehouseValues.add(wh);
      }
      const whText = Array.from(warehouseValues).join("|");

      if (whText.includes("용마") || whText.includes("CDV") || whText.includes("안성(CDV)")) {
        return { type: "client", confidence: "high", reason: "출고현황 - 용마/CDV 창고 감지" };
      }
      if (whText.includes("GIG") || whText.includes("DL") || whText.includes("안성(DL)")) {
        return { type: "dl-client", confidence: "high", reason: "출고현황 - GIG/DL 창고 감지" };
      }

      const fname = file.name.toLowerCase();
      if (fname.includes("dl") || fname.includes("글라스") || fname.includes("glass") || fname.includes("riedel")) {
        return { type: "dl-client", confidence: "medium", reason: "출고현황 - 파일명에 DL/글라스 포함" };
      }
      return { type: "client", confidence: "medium", reason: "출고현황 - 컬럼 수 30+ (CDV 추정)" };
    }

    // 3) 수금내역
    if (colCount >= 10 && colCount <= 20) {
      let hasCarryover = false;
      for (let i = 1; i < Math.min(50, rows.length); i++) {
        const r = rows[i] as unknown[];
        if (r[4] === "이월") {
          hasCarryover = true;
          break;
        }
      }

      if (hasCarryover) {
        const fname = file.name.toLowerCase();
        if (fname.includes("dl") || fname.includes("글라스") || fname.includes("glass") || fname.includes("riedel")) {
          return { type: "dl-payments", confidence: "high", reason: "수금내역 - 이월행 + 파일명 DL" };
        }
        const depts = new Set<string>();
        for (let i = 1; i < Math.min(100, rows.length); i++) {
          const r = rows[i] as unknown[];
          const dept = String(r[12] ?? "").trim();
          if (dept) depts.add(dept);
        }
        const deptText = Array.from(depts).join("|");
        if (deptText.includes("DL") || deptText.includes("글라스")) {
          return { type: "dl-payments", confidence: "high", reason: "수금내역 - 부서에 DL 포함" };
        }
        return { type: "payments", confidence: "medium", reason: "수금내역 - 이월행 감지 (CDV 추정)" };
      }
    }

    return { type: "unknown", confidence: "low", reason: `헤더 패턴 미매칭 (컬럼 ${colCount}개)` };
  } catch {
    return { type: "unknown", confidence: "low", reason: "파일 분석 실패" };
  }
}
