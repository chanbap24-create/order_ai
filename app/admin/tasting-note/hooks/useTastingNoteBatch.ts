import { useState } from "react";
import type { TastingWineRow } from "../types";

type Params = {
  wines: TastingWineRow[];
  checkedIds: Set<string>;
  setCheckedIds: (s: Set<string>) => void;
  refreshList: () => void;
  /** ghIndex 강제 재로딩 (PDF 업로드 후 호출하여 캐시 우회) */
  refreshGhIndex?: (force?: boolean) => Promise<void> | void;
  loadSelectedDetail: (code: string) => Promise<void>;
  selectedId: string | null;
};

/** TastingNote 배치 작업: 일괄 조사 + PPT/PDF 다운로드 + GitHub 업로드 + 인덱스 + 단일 파일 업로드 */
export function useTastingNoteBatch(p: Params) {
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentName: "" });
  const [uploadingGithub, setUploadingGithub] = useState(false);
  const [dispatchingIndex, setDispatchingIndex] = useState(false);
  const [batchDownloading, setBatchDownloading] = useState<"pptx" | "pdf" | null>(null);
  const [generatingPpt, setGeneratingPpt] = useState(false);
  // 행별 단일 파일 업로드 진행 중인 item_code (1번에 1개만 허용)
  const [uploadingFileId, setUploadingFileId] = useState<string | null>(null);

  const batchResearch = async () => {
    const ids = [...p.checkedIds];
    if (ids.length === 0) {
      alert("일괄 조사할 와인을 선택하세요.");
      return;
    }
    const validIds = ids.filter((id) => {
      const w = p.wines.find((w) => w.item_code === id);
      return w && w.item_name_en?.trim();
    });
    if (validIds.length === 0) {
      alert("선택한 와인 중 영문명이 입력된 것이 없습니다.");
      return;
    }

    setBatchRunning(true);
    setBatchProgress({ current: 0, total: validIds.length, currentName: "" });
    for (let i = 0; i < validIds.length; i++) {
      const id = validIds[i];
      const w = p.wines.find((w) => w.item_code === id);
      setBatchProgress({
        current: i + 1,
        total: validIds.length,
        currentName: w?.item_name_en || w?.item_name_kr || id,
      });
      try {
        await fetch("/api/admin/wine-research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wine_id: id,
            product_name_eng: w?.item_name_en || "",
            item_name_kr: w?.item_name_kr || "",
            vintage: w?.vintage || "",
            supplier: w?.supplier || w?.supplier_kr || "",
          }),
        });
      } catch {
        /* continue */
      }
    }
    setBatchRunning(false);
    p.setCheckedIds(new Set());
    p.refreshList();
    if (p.selectedId) p.loadSelectedDetail(p.selectedId);
  };

  const generatePpt = async (itemCode: string) => {
    setGeneratingPpt(true);
    try {
      const res = await fetch("/api/admin/tasting-notes/generate-ppt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wineIds: [itemCode] }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        alert(`PPT 생성 실패: ${err.error || res.statusText}`);
        setGeneratingPpt(false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${itemCode}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`PPT 오류: ${e instanceof Error ? e.message : "알 수 없는 오류"}`);
    }
    setGeneratingPpt(false);
  };

  const batchDownload = async (format: "pptx" | "pdf") => {
    const ids = [...p.checkedIds];
    if (ids.length === 0) {
      alert("다운로드할 와인을 선택하세요.");
      return;
    }
    setBatchDownloading(format);
    try {
      const res = await fetch("/api/admin/tasting-notes/download-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wineIds: ids, format }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        alert(`다운로드 실패: ${err.error || res.statusText}`);
        setBatchDownloading(null);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tasting-notes-${ids.length}wines-${format}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`다운로드 오류: ${e instanceof Error ? e.message : "알 수 없는 오류"}`);
    }
    setBatchDownloading(null);
  };

  const githubRelease = async (format: "pptx" | "pdf") => {
    const ids = [...p.checkedIds];
    if (ids.length === 0) {
      alert("업로드할 와인을 선택하세요.");
      return;
    }
    const label = format.toUpperCase();
    if (!confirm(`${ids.length}개 와인의 ${label}을 GitHub에 업로드하시겠습니까?`)) return;

    setUploadingGithub(true);
    try {
      const res = await fetch("/api/admin/github-release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wineIds: ids, format }),
      });
      const data = await res.json();
      if (data.success) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fails = (data.results || []).filter((r: any) => r.error);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const failDetails = fails.map((r: any) => `${r.wineId}: ${r.error}`).join("\n");
        alert(
          `${label} 업로드 완료: 성공 ${data.uploaded}개, 실패 ${data.failed}개${failDetails ? "\n\n실패 상세:\n" + failDetails : ""}`,
        );
        // 일괄 업로드도 ghIndex 강제 갱신
        try {
          await p.refreshGhIndex?.(true);
        } catch {
          /* ignore */
        }
      } else {
        alert(`${label} 업로드 실패: ${data.error || "알 수 없는 오류"}`);
      }
    } catch (e) {
      alert(`GitHub 오류: ${e instanceof Error ? e.message : "알 수 없는 오류"}`);
    }
    setUploadingGithub(false);
  };

  const dispatchIndex = async () => {
    if (!confirm("GitHub Actions로 인덱스를 업데이트하시겠습니까?")) return;
    setDispatchingIndex(true);
    try {
      const res = await fetch("/api/admin/github-dispatch", { method: "POST" });
      const data = await res.json();
      if (data.success) alert("인덱스 업데이트 워크플로우가 실행되었습니다.");
      else alert(`실행 실패: ${data.error || "알 수 없는 오류"}`);
    } catch (e) {
      alert(`오류: ${e instanceof Error ? e.message : "알 수 없는 오류"}`);
    }
    setDispatchingIndex(false);
  };

  /**
   * 행별 단일 파일 업로드: 사용자가 PDF/PPTX 를 선택하면
   * 파일명을 item_code 로 강제 변경하여 GitHub Release 에 업로드.
   * 확장자(.pdf / .pptx)는 파일 이름으로 자동 인식.
   */
  const uploadFileForWine = async (itemCode: string, file: File) => {
    const ext = file.name.toLowerCase().match(/\.(pdf|pptx)$/)?.[1];
    if (!ext) {
      alert("PDF 또는 PPTX 파일만 업로드할 수 있습니다.");
      return;
    }
    if (uploadingFileId) {
      alert("다른 업로드가 진행 중입니다. 완료 후 시도해주세요.");
      return;
    }
    setUploadingFileId(itemCode);
    try {
      const form = new FormData();
      form.append("wineId", itemCode);
      form.append("file", file);
      const res = await fetch("/api/admin/tasting-notes/upload-single", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (data.success) {
        // 인덱스 새로고침은 PDF 일 때 서버가 자동 수행. 리스트 + 클라이언트 ghIndex 도 강제 갱신.
        p.refreshList();
        try {
          await p.refreshGhIndex?.(true);
        } catch {
          /* ignore */
        }
      } else {
        alert(`업로드 실패: ${data.error || "알 수 없는 오류"}`);
      }
    } catch (e) {
      alert(`업로드 오류: ${e instanceof Error ? e.message : "알 수 없는 오류"}`);
    }
    setUploadingFileId(null);
  };

  return {
    batchRunning, batchProgress,
    uploadingGithub, dispatchingIndex,
    batchDownloading,
    generatingPpt,
    uploadingFileId,
    batchResearch, batchDownload, githubRelease, dispatchIndex, generatePpt,
    uploadFileForWine,
  };
}
