import { useCallback, useState } from "react";
import type { TastingNote, Wine } from "@/app/types/wine";
import type { EditForm, EditFormKey } from "../types";
import { EMPTY_EDIT_FORM } from "../constants";

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

  const loadWineDetail = useCallback(async (itemCode: string) => {
    try {
      const res = await fetch(`/api/admin/wines/${itemCode}`);
      const data = await res.json();
      if (data.success) {
        setSelectedWine(data.data.wine);
        const tn = data.data.tastingNote || null;
        setTastingNote(tn);
        setEngNameInput(data.data.wine.item_name_en || "");
        setImageUrlInput(data.data.wine.image_url || "");
        setImageUrlExpanded(!data.data.wine.image_url);
        initEditForm(data.data.wine, tn);
      }
    } catch (e) {
      console.error("와인 상세 로드 실패:", e);
    }
  }, []);

  const selectWineFromList = (wine: Wine) => {
    // 즉시 리스트 데이터로 표시 후 비동기 상세 로드
    setSelectedWine(wine);
    setEngNameInput(wine.item_name_en || "");
    setImageUrlInput(wine.image_url || "");
    setImageUrlExpanded(!wine.image_url);
    setTastingNote(null);
    initEditForm(wine, null);
    loadWineDetail(wine.item_code);
  };

  const updateField = (key: EditFormKey, val: string) =>
    setEditForm((prev) => ({ ...prev, [key]: val }));

  const saveEngName = async () => {
    if (!selectedWine || !engNameInput.trim()) return;
    try {
      await fetch(`/api/admin/wines/${selectedWine.item_code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wine: { item_name_en: engNameInput.trim() } }),
      });
      setSelectedWine({ ...selectedWine, item_name_en: engNameInput.trim() });
      // 단순 필드: 전체 재조회 대신 로컬 행 갱신 → 정렬/스크롤/선택 유지
      if (patchWine) patchWine(selectedWine.item_code, { item_name_en: engNameInput.trim() });
      else refreshList();
    } catch {
      /* ignore */
    }
  };

  const saveImageUrl = async (url: string | null) => {
    if (!selectedWine) return;
    setSavingImageUrl(true);
    try {
      await fetch(`/api/admin/wines/${selectedWine.item_code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wine: { image_url: url } }),
      });
      setSelectedWine({ ...selectedWine, image_url: url });
      if (!url) {
        setImageUrlInput("");
        setImageUrlExpanded(true);
      } else {
        setImageUrlExpanded(false);
      }
      // 이미지 URL 저장: 전체 재조회 대신 로컬 행 갱신 → 맨 위로 점프/스크롤 초기화 방지
      if (patchWine) patchWine(selectedWine.item_code, { image_url: url });
      else refreshList();
    } catch {
      /* ignore */
    }
    setSavingImageUrl(false);
  };

  const doResearch = async () => {
    if (!selectedWine) return;
    const engName = engNameInput.trim() || selectedWine.item_name_en;
    if (!engName) {
      alert("영문명을 먼저 입력해주세요.");
      return;
    }
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
    savingImageUrl,
    researching, saving, approving,
    loadWineDetail, selectWineFromList,
    saveEngName, saveImageUrl, doResearch, handleSave, handleApprove,
  };
}
