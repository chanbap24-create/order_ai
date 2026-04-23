import { useState } from "react";
import type ExcelJS from "exceljs";
import type { PreviewRow, VehicleInfo } from "../types";
import { deletePreviewRow, extractPreviewData } from "../lib/excelOps";

type Params = {
  setUnsaved: () => void;
};

/** 우측 슬라이드 미리보기 패널 state + 행 삭제 */
export function useExcelPreview(p: Params) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo | null>(null);

  const openPreview = (workbook: ExcelJS.Workbook, selectedSheet: string) => {
    if (!workbook || !selectedSheet) return;
    const { rows, vehicleInfo: vi } = extractPreviewData(workbook, selectedSheet);
    setPreviewRows(rows);
    setVehicleInfo(vi);
    setPreviewOpen(true);
  };

  const handleDeletePreviewRow = (
    workbook: ExcelJS.Workbook | null,
    selectedSheet: string,
    excelRowNum: number,
  ) => {
    if (!workbook || !selectedSheet) return;
    deletePreviewRow(workbook, selectedSheet, excelRowNum);
    p.setUnsaved();
    openPreview(workbook, selectedSheet);
  };

  return {
    previewOpen, setPreviewOpen,
    previewRows, vehicleInfo,
    openPreview, handleDeletePreviewRow,
  };
}
