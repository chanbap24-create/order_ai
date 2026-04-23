import { useState } from "react";
import type { WineWithStatus } from "../types";

type Params = {
  wines: WineWithStatus[];
  checkedIds: Set<string>;
  setCheckedIds: (s: Set<string>) => void;
  refreshList: () => void;
  loadSelectedDetail: (code: string) => Promise<void>;
  selectedId: string | null;
};

/** 일괄 조사 / 일괄 PPT / ZIP / GitHub / 인덱스 배치 작업 */
export function useBatchOperations(p: Params) {
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentName: "" });
  const [batchPptRunning, setBatchPptRunning] = useState(false);
  const [batchPptProgress, setBatchPptProgress] = useState({ current: 0, total: 0 });
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [uploadingGithub, setUploadingGithub] = useState(false);
  const [dispatchingIndex, setDispatchingIndex] = useState(false);
  const [generatingPpt, setGeneratingPpt] = useState(false);

  const _approvedChecked = () =>
    [...p.checkedIds].filter((id) => {
      const w = p.wines.find((w) => w.item_code === id);
      return w && w.wine_status === "approved";
    });

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
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        alert(`PPT 생성 실패: ${errData.error || res.statusText}`);
        setGeneratingPpt(false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${itemCode}.pptx`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (e) {
      alert(`PPT 다운로드 오류: ${e instanceof Error ? e.message : "알 수 없는 오류"}`);
    }
    setGeneratingPpt(false);
  };

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
      } catch {
        /* continue */
      }
    }
    setBatchPptRunning(false);
    p.refreshList();
    alert(`${approvedIds.length}개 PPT 생성 완료`);
  };

  const downloadZip = async () => {
    const approvedIds = _approvedChecked();
    if (approvedIds.length === 0) {
      alert("승인된 와인을 선택하세요.");
      return;
    }
    setDownloadingZip(true);
    try {
      const res = await fetch("/api/admin/tasting-notes/download-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wineIds: approvedIds }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `tasting-notes-${approvedIds.length}wines.zip`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const data = await res.json();
        alert(`ZIP 생성 실패: ${data.error || "알 수 없는 오류"}`);
      }
    } catch (e) {
      alert(`ZIP 다운로드 오류: ${e instanceof Error ? e.message : "알 수 없는 오류"}`);
    }
    setDownloadingZip(false);
  };

  const githubRelease = async (format: "pptx" | "pdf") => {
    const approvedIds = _approvedChecked();
    if (approvedIds.length === 0) {
      alert("승인된 와인을 선택하세요.");
      return;
    }
    const label = format.toUpperCase();
    if (!confirm(`${approvedIds.length}개 와인의 ${label}을 GitHub에 업로드하시겠습니까?`)) return;

    setUploadingGithub(true);
    try {
      const res = await fetch("/api/admin/github-release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wineIds: approvedIds, format }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`${label} GitHub 업로드 완료: 성공 ${data.uploaded}개, 실패 ${data.failed}개`);
      } else {
        alert(`${label} GitHub 업로드 실패: ${data.error || "알 수 없는 오류"}`);
      }
    } catch (e) {
      alert(`GitHub 오류: ${e instanceof Error ? e.message : "알 수 없는 오류"}`);
    }
    setUploadingGithub(false);
  };

  const dispatchIndex = async () => {
    if (!confirm("GitHub Actions 워크플로우를 실행하여 인덱스를 업데이트하시겠습니까?")) return;
    setDispatchingIndex(true);
    try {
      const res = await fetch("/api/admin/github-dispatch", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert("인덱스 업데이트 워크플로우가 실행되었습니다. GitHub Actions에서 진행 상황을 확인하세요.");
      } else {
        alert(`워크플로우 실행 실패: ${data.error || "알 수 없는 오류"}`);
      }
    } catch (e) {
      alert(`오류: ${e instanceof Error ? e.message : "알 수 없는 오류"}`);
    }
    setDispatchingIndex(false);
  };

  return {
    batchRunning, batchProgress,
    batchPptRunning, batchPptProgress,
    downloadingZip, uploadingGithub, dispatchingIndex,
    generatingPpt,
    batchResearch, batchPptGenerate, downloadZip, githubRelease, dispatchIndex, generatePpt,
  };
}
