import { useRef, useState } from "react";
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
  const [generatingPpt, setGeneratingPpt] = useState(false);
  const [batchPptRunning, setBatchPptRunning] = useState(false);
  const [batchPptProgress, setBatchPptProgress] = useState({ current: 0, total: 0 });
  // 행별 단일 파일 업로드 진행 중인 item_code (1번에 1개만 허용)
  const [uploadingFileId, setUploadingFileId] = useState<string | null>(null);
  // 일괄조사 중지 플래그 — true 면 다음 건부터 호출하지 않음 (진행 중인 1건은 완료됨)
  const batchCancelRef = useRef(false);

  /** 일괄조사 중지 — 진행 중인 건까지만 끝내고 나머지는 호출하지 않음 */
  const cancelBatchResearch = () => {
    batchCancelRef.current = true;
  };

  // 승인된 노트가 있는 선택 와인
  const _approvedChecked = () =>
    [...p.checkedIds].filter((id) => {
      const w = p.wines.find((w) => w.item_code === id);
      return w && w.verification_status === "approved";
    });

  // 선택한 (승인) 와인들 PPT 일괄 생성
  const batchPptGenerate = async () => {
    const approvedIds = _approvedChecked();
    if (approvedIds.length === 0) {
      alert("승인된 와인을 선택하세요.");
      return;
    }
    setBatchPptRunning(true);
    setBatchPptProgress({ current: 0, total: approvedIds.length });
    for (let i = 0; i < approvedIds.length; i++) {
      setBatchPptProgress({ current: i + 1, total: approvedIds.length });
      try {
        await fetch("/api/admin/tasting-notes/generate-ppt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wineIds: [approvedIds[i]] }),
        });
      } catch { /* continue */ }
    }
    setBatchPptRunning(false);
    p.refreshList();
    alert(`${approvedIds.length}개 PPT 생성 완료`);
  };

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

    // 실수 클릭 방지: API 비용이 발생하는 작업이라 시작 전 확인
    if (!confirm(`${validIds.length}개 와인을 일괄 조사할까요?\nAPI 비용이 발생하며, 진행 중에는 '중지' 버튼으로 멈출 수 있습니다.`)) {
      return;
    }

    batchCancelRef.current = false;
    setBatchRunning(true);
    setBatchProgress({ current: 0, total: validIds.length, currentName: "" });
    let done = 0;
    for (let i = 0; i < validIds.length; i++) {
      if (batchCancelRef.current) break;
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
      done = i + 1;
    }
    const stopped = batchCancelRef.current;
    setBatchRunning(false);
    p.setCheckedIds(new Set());
    p.refreshList();
    if (p.selectedId) p.loadSelectedDetail(p.selectedId);
    if (stopped) {
      alert(`일괄조사를 중지했습니다. (${done}/${validIds.length}건 완료)`);
    }
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
        // 결과 피드백 — 사용자가 반영 여부를 확실히 알 수 있게
        alert(
          `업로드 완료: ${data.fileName}` +
            (data.format === "pdf" && data.indexTotal
              ? `\n인덱스 갱신: ${data.indexTotal}건`
              : ""),
        );
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
    generatingPpt,
    batchPptRunning, batchPptProgress,
    uploadingFileId,
    batchResearch, cancelBatchResearch, githubRelease, dispatchIndex, generatePpt,
    batchPptGenerate,
    uploadFileForWine,
  };
}
