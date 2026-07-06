import { useCallback, useRef, useState } from "react";
import type { TastingNote, Wine } from "@/app/types/wine";
import type { EditForm, EditFormKey } from "../types";
import { EMPTY_EDIT_FORM } from "../constants";
import { checkVintage } from "@/app/lib/vintageCheck";

/** 중앙 편집 패널 state: selectedWine + tastingNote + editForm + save/approve 핸들러 */
export function useWineDetail(
  refreshList: () => void,
  /** 단일 행 로컬 갱신 — 있으면 단순 필드 저장 시 전체 재조회(정렬/스크롤 점프) 대신 사용 */
  patchWine?: (itemCode: string, patch: Record<string, unknown>) => void,
) {
  const [selectedWine, setSelectedWine] = useState<Wine | null>(null);
  const [tastingNote, setTastingNote] = useState<TastingNote | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT_FORM);
  const [engNameInput, setEngNameInput] = useState("");
  const [researching, setResearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [imageUrlExpanded, setImageUrlExpanded] = useState(false);
  const [savingImageUrl, setSavingImageUrl] = useState(false);
  const [regeneratingNote, setRegeneratingNote] = useState(false);

  const initEditForm = (wine: Wine, tn: TastingNote | null) => {
    setEditForm({
      grape_varieties: wine.grape_varieties || "",
      region: wine.region || "",
      alcohol: wine.alcohol || "",
      serving_temp: tn?.serving_temp || "",
      winery_description: tn?.winery_description || "",
      winemaking: tn?.winemaking || "",
      vintage_note: tn?.vintage_note || "",
      color_note: tn?.color_note || "",
      nose_note: tn?.nose_note || "",
      palate_note: tn?.palate_note || "",
      food_pairing: tn?.food_pairing || "",
      glass_pairing: tn?.glass_pairing || "",
      awards: tn?.awards || "",
      aging_potential: tn?.aging_potential || "",
    });
  };

  // 가장 최근에 선택/로드 요청한 품번 — 늦게 도착한 stale 응답을 무시하기 위함
  const latestCodeRef = useRef<string | null>(null);

  /**
   * 와인 상세 로드. seedInputs=false(선택 시)면 영문명/이미지 입력칸은 건드리지 않음
   * — 사용자가 막 붙여넣은 값을 비동기 응답이 덮어쓰는 경쟁 조건 방지.
   * 응답이 최신 선택이 아니면(빠른 클릭 전환) 무시.
   */
  const loadWineDetail = useCallback(
    async (itemCode: string, opts?: { seedInputs?: boolean }) => {
      latestCodeRef.current = itemCode;
      try {
        const res = await fetch(`/api/admin/wines/${itemCode}`);
        const data = await res.json();
        if (latestCodeRef.current !== itemCode) return; // stale 응답 무시
        if (data.success) {
          setSelectedWine(data.data.wine);
          const tn = data.data.tastingNote || null;
          setTastingNote(tn);
          if (opts?.seedInputs !== false) {
            setEngNameInput(data.data.wine.item_name_en || "");
            setImageUrlInput(data.data.wine.image_url || "");
            setImageUrlExpanded(!data.data.wine.image_url);
          }
          initEditForm(data.data.wine, tn);
        }
      } catch (e) {
        console.error("와인 상세 로드 실패:", e);
      }
    },
    [],
  );

  const selectWineFromList = (wine: Wine) => {
    latestCodeRef.current = wine.item_code;
    // 즉시 리스트 데이터로 입력칸 seed 후, 상세는 입력칸 건드리지 않고 로드(붙여넣기 보존)
    setSelectedWine(wine);
    setEngNameInput(wine.item_name_en || "");
    setImageUrlInput(wine.image_url || "");
    setImageUrlExpanded(!wine.image_url);
    setTastingNote(null);
    initEditForm(wine, null);
    loadWineDetail(wine.item_code, { seedInputs: false });
  };

  const updateField = (key: EditFormKey, val: string) =>
    setEditForm((prev) => ({ ...prev, [key]: val }));

  const saveEngName = async () => {
    if (!selectedWine || !engNameInput.trim()) return;
    const code = selectedWine.item_code;
    const snapshot = selectedWine;
    const value = engNameInput.trim();
    try {
      await fetch(`/api/admin/wines/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wine: { item_name_en: value } }),
      });
      // 저장 대상 행은 항상 갱신(목록). 패널은 아직 같은 와인일 때만 갱신.
      if (patchWine) patchWine(code, { item_name_en: value });
      else refreshList();
      if (latestCodeRef.current === code) setSelectedWine({ ...snapshot, item_name_en: value });
    } catch {
      /* ignore */
    }
  };

  const saveImageUrl = async (url: string | null) => {
    if (!selectedWine) return;
    const code = selectedWine.item_code;
    const snapshot = selectedWine;
    setSavingImageUrl(true);
    try {
      await fetch(`/api/admin/wines/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wine: { image_url: url } }),
      });
      // 저장 대상 행은 항상 갱신(목록). 패널 상태는 아직 같은 와인일 때만 갱신.
      if (patchWine) patchWine(code, { image_url: url });
      else refreshList();
      if (latestCodeRef.current === code) {
        setSelectedWine({ ...snapshot, image_url: url });
        if (!url) {
          setImageUrlInput("");
          setImageUrlExpanded(true);
        } else {
          setImageUrlExpanded(false);
        }
      }
    } catch {
      /* ignore */
    }
    setSavingImageUrl(false);

    // 이미지가 바뀌면 테이스팅 노트 PPTX/PDF를 새 이미지로 재생성·재업로드(노트 있는 와인만).
    setRegeneratingNote(true);
    try {
      const r = await fetch("/api/admin/tasting-notes/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wineId: code }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || (j && j.success === false)) {
        console.warn(`[Regenerate] ${j?.error || r.status}`);
      }
    } catch {
      /* 재생성 실패는 이미지 저장 자체를 막지 않음 */
    }
    setRegeneratingNote(false);
  };

  const doResearch = async () => {
    if (!selectedWine) return;
    const engName = engNameInput.trim() || selectedWine.item_name_en;
    if (!engName) {
      alert("영문명을 먼저 입력해주세요.");
      return;
    }
    // 빈티지 확인 — 노트·PPT가 vintage에서 파생되므로 오입력(예: 22↔23)을 여기서 차단.
    const vc = checkVintage(selectedWine.vintage);
    const vLabel = vc.display || "(빈티지 없음)";
    const vWarn = vc.level !== "ok" ? `\n\n⚠ ${vc.message}` : "";
    if (!confirm(
      `이 빈티지로 AI 조사·테이스팅 노트를 생성합니다.\n\n  빈티지: ${vLabel}${vWarn}\n\n` +
      `빈티지가 정확한가요?\n(틀리면 [취소] 후 재고/원장에서 빈티지를 먼저 바로잡으세요 — 원본이 안 고쳐지면 동기화 때 되돌아갑니다.)`
    )) return;
    setResearching(true);
    try {
      const res = await fetch("/api/admin/wine-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wine_id: selectedWine.item_code,
          product_name_eng: engName,
          item_name_kr: selectedWine.item_name_kr,
          vintage: selectedWine.vintage || "",
          supplier: selectedWine.supplier || selectedWine.supplier_kr || "",
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.verification_status === "mismatch") {
          alert(data.message || "생산자가 다른 와인일 수 있습니다. 결과는 저장했으니 내용을 확인해주세요.");
        } else if (data.verification_status === "warning") {
          alert("생산자 확인 필요: 조사된 와인의 생산자가 다를 수 있습니다. 확인 후 승인해주세요.");
        }
        await loadWineDetail(selectedWine.item_code);
        refreshList();
      } else {
        alert(`조사 실패: ${data.error || "알 수 없는 오류"}`);
      }
    } catch (e) {
      alert(`조사 중 오류: ${e instanceof Error ? e.message : "알 수 없는 오류"}`);
    }
    setResearching(false);
  };

  const handleSave = async () => {
    if (!selectedWine) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/wines/${selectedWine.item_code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wine: {
            grape_varieties: editForm.grape_varieties,
            region: editForm.region,
            alcohol: editForm.alcohol,
          },
        }),
      });
      await fetch(`/api/admin/tasting-notes/${selectedWine.item_code}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serving_temp: editForm.serving_temp,
          winery_description: editForm.winery_description,
          winemaking: editForm.winemaking,
          vintage_note: editForm.vintage_note,
          color_note: editForm.color_note,
          nose_note: editForm.nose_note,
          palate_note: editForm.palate_note,
          food_pairing: editForm.food_pairing,
          glass_pairing: editForm.glass_pairing,
          awards: editForm.awards,
          aging_potential: editForm.aging_potential,
        }),
      });
      await loadWineDetail(selectedWine.item_code);
      refreshList();
    } catch {
      /* ignore */
    }
    setSaving(false);
  };

  const handleApprove = async () => {
    if (!selectedWine) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/admin/tasting-notes/${selectedWine.item_code}/approve`, {
        method: "PUT",
      });
      const data = await res.json();
      if (data.success) {
        await loadWineDetail(selectedWine.item_code);
        refreshList();
      } else {
        alert(`승인 실패: ${data.error || "알 수 없는 오류"}`);
      }
    } catch {
      /* ignore */
    }
    setApproving(false);
  };

  return {
    selectedWine, setSelectedWine,
    tastingNote,
    editForm, updateField,
    engNameInput, setEngNameInput,
    imageUrlInput, setImageUrlInput,
    imageUrlExpanded, setImageUrlExpanded,
    savingImageUrl, regeneratingNote,
    researching, saving, approving,
    loadWineDetail, selectWineFromList,
    saveEngName, saveImageUrl, doResearch, handleSave, handleApprove,
  };
}
