import { useEffect, useState } from "react";
import type ExcelJSType from "exceljs";
import type { ExpenseItem, SaveStatus } from "../types";
import { getCurrentMonthSheet, writeItemToSheet } from "../lib/excelOps";

/** ExcelJS 는 910KB 라이브러리 — 실제로 파일을 읽거나 쓸 때만 dynamic import */
let excelJsPromise: Promise<typeof import("exceljs").default> | null = null;
async function loadExcelJS() {
  if (!excelJsPromise) {
    excelJsPromise = import("exceljs").then(m => m.default);
  }
  return excelJsPromise;
}

type Params = {
  currentManager: string;
  department?: string;
};

/** 엑셀 워크북 자동 로드 + 업로드 + 시트 선택 + 서버 저장 + 다운로드 */
export function useExpenseWorkbook(p: Params) {
  const [workbook, setWorkbook] = useState<ExcelJSType.Workbook | null>(null);
  const [fileName, setFileName] = useState("");
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [excelLoading, setExcelLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // 저장된 엑셀 자동 로드
  useEffect(() => {
    if (!p.currentManager) {
      setAutoLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `/api/sales/expense/file?manager=${encodeURIComponent(p.currentManager)}`,
        );
        const data = await res.json();
        if (data.exists && data.data) {
          const ExcelJS = await loadExcelJS();
          const buffer = Uint8Array.from(atob(data.data), (c) => c.charCodeAt(0));
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.load(buffer.buffer as ArrayBuffer);
          const names = wb.worksheets.map((ws) => ws.name).filter((n) => n !== "계정과목");
          setWorkbook(wb);
          setFileName(data.fileName || `${p.currentManager}.xlsx`);
          setSheetNames(names);
          setSelectedSheet(getCurrentMonthSheet(names));
          setSaveStatus("saved");
        }
      } catch {
        /* 저장된 파일 없음 — 무시 */
      }
      setAutoLoading(false);
    })();
  }, [p.currentManager]);

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelLoading(true);
    try {
      const ExcelJS = await loadExcelJS();
      const buffer = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const names = wb.worksheets.map((ws) => ws.name).filter((n) => n !== "계정과목");
      setWorkbook(wb);
      setFileName(file.name);
      setSheetNames(names);
      setSelectedSheet(getCurrentMonthSheet(names));
      setSaveStatus("unsaved");
    } catch {
      alert("엑셀 파일을 읽을 수 없습니다.");
    } finally {
      setExcelLoading(false);
    }
  };

  /** 큐 항목을 워크북에 기입 + Storage 업로드 */
  const save = async (items: ExpenseItem[], onItemsCleared: () => void) => {
    if (!workbook) return;
    setSaveStatus("saving");
    try {
      if (items.length > 0) {
        for (const item of items) writeItemToSheet(workbook, selectedSheet, item);
        onItemsCleared();
      }
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const formData = new FormData();
      formData.append("manager", p.currentManager);
      formData.append("file", blob, `${p.currentManager}.xlsx`);
      const res = await fetch("/api/sales/expense/file", { method: "PUT", body: formData });
      const result = await res.json();
      if (result.ok) setSaveStatus("saved");
      else {
        alert("저장 실패: " + (result.error || ""));
        setSaveStatus("unsaved");
      }
    } catch {
      alert("서버 연결 실패");
      setSaveStatus("unsaved");
    }
  };

  /** 대기 항목 기입 후 로컬 다운로드 */
  const download = async (items: ExpenseItem[], onItemsCleared: () => void) => {
    if (!workbook) return;
    if (items.length > 0) {
      for (const item of items) writeItemToSheet(workbook, selectedSheet, item);
      onItemsCleared();
    }
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const year = new Date().getFullYear();
    a.download = `법인카드 사용내역_${p.department || ""}${p.department ? " " : ""}${p.currentManager} ${year}년.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    workbook, setWorkbook,
    fileName, sheetNames, selectedSheet, setSelectedSheet,
    excelLoading, autoLoading,
    saveStatus, setSaveStatus,
    handleExcelUpload, save, download,
  };
}
