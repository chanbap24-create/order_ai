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

    // 1.7) 거래처정보(ERP 거래처 명부) — 컬럼 30+지만 출고/재고/수금과 헤더가 다름.
    //   거래처번호+상호+영업담당자 있고 출고(판매처/출고일)·재고(품번)는 없음.
    //   출고현황 분기(colCount>=30)보다 먼저 걸러야 오판(사업장소재지 헤더가 '사업장' 매치) 방지.
    if (
      headerText.includes("거래처번호") &&
      headerText.includes("상호") &&
      headerText.includes("영업담당자") &&
      !headerText.includes("판매처") &&
      !headerText.includes("출고일") &&
      !headerText.includes("품번")
    ) {
      const upCol = headers.findIndex((h) => h.includes("업종구분"));
      const ui = upCol >= 0 ? upCol : 9;
      const upVals = new Set<string>();
      for (let i = 1; i < Math.min(400, rows.length); i++) {
        const v = String((rows[i] as unknown[])[ui] ?? "").trim();
        if (v) upVals.add(v);
      }
      const upText = Array.from(upVals).join("|");
      const fname = file.name.toLowerCase();
      // CDV(와인)는 업종에 on//off/ 프리픽스. DL(글라스)은 프리픽스 없음 + 기물벤더/리빙샵 고유.
      if (upText.includes("on/") || upText.includes("off/")) {
        return { type: "client-info", confidence: "high", reason: "거래처정보 - 업종 on//off/ 프리픽스 (CDV 와인)" };
      }
      if (upText.includes("기물벤더") || upText.includes("리빙샵") || fname.includes("dl") || fname.includes("글라스") || fname.includes("대유")) {
        return { type: "dl-client-info", confidence: "high", reason: "거래처정보 - 글라스 고유 업종/파일명 (DL)" };
      }
      return { type: "client-info", confidence: "medium", reason: "거래처정보 - CDV 추정 (필요시 글라스로 변경)" };
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

        // 1순위: 업종구분(K열, idx10) — 와인/글라스 업종 체계가 다름(가장 신뢰도 높음).
        //   와인(CDV): 'on/업소' 'off/편의점' 처럼 on//off/ 프리픽스(업장 구분).
        //   글라스(DL): '기물벤더' '백화점(리빙)' '온라인' 등 글라스 고유 업종 (on//off/ 없음).
        const upjongVals = new Set<string>();
        for (let i = 1; i < Math.min(200, rows.length); i++) {
          const v = String((rows[i] as unknown[])[10] ?? "").trim();
          if (v) upjongVals.add(v);
        }
        const upjongText = Array.from(upjongVals).join("|");
        if (upjongText.includes("기물벤더") || upjongText.includes("백화점(리빙)") || upjongText.includes("리빙")) {
          return { type: "dl-payments", confidence: "high", reason: "수금내역 - 업종구분 글라스 고유(기물벤더/리빙) (DL)" };
        }
        if (upjongText.includes("on/") || upjongText.includes("off/")) {
          return { type: "payments", confidence: "high", reason: "수금내역 - 업종구분 on//off/ 프리픽스 (CDV 와인)" };
        }

        // 2순위(fallback): 부서(M열, idx12)에 DL/글라스 표기.
        const depts = new Set<string>();
        for (let i = 1; i < Math.min(100, rows.length); i++) {
          const r = rows[i] as unknown[];
          const dept = String(r[12] ?? "").trim();
          if (dept) depts.add(dept);
        }
        const deptText = Array.from(depts).join("|");
        if (deptText.includes("DL") || deptText.includes("글라스") || deptText.includes("이커머스")) {
          return { type: "dl-payments", confidence: "medium", reason: "수금내역 - 부서에 DL/이커머스 포함" };
        }
        return { type: "payments", confidence: "medium", reason: "수금내역 - 이월행 감지 (CDV 추정)" };
      }
    }

    return { type: "unknown", confidence: "low", reason: `헤더 패턴 미매칭 (컬럼 ${colCount}개)` };
  } catch {
    return { type: "unknown", confidence: "low", reason: "파일 분석 실패" };
  }
}
