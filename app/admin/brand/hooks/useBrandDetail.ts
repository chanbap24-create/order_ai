import { useState } from "react";
import type {
  Brand,
  BrandResearchResult,
  BrandValidation,
} from "@/app/types/wine";
import type { LinkedWine, ViewMode } from "../types";

type Params = {
  onListReload: () => void;
  showToast: (msg: string) => void;
};

/**
 * 브랜드 상세/편집/신규 state + 저장/삭제/AI조사/연결된 와인 로드.
 * list ↔ detail 전환도 함께 관리.
 */
export function useBrandDetail(p: Params) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [editForm, setEditForm] = useState<Partial<Brand>>({});
  const [saving, setSaving] = useState(false);
  const [researching, setResearching] = useState(false);
  const [extractingLogo, setExtractingLogo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [linkedWines, setLinkedWines] = useState<LinkedWine[]>([]);
  const [isNew, setIsNew] = useState(false);
  const [validation, setValidation] = useState<BrandValidation | null>(null);
  const [listDirty, setListDirty] = useState(false);

  const loadLinkedWines = async (brandId: number) => {
    try {
      const res = await fetch(`/api/admin/brands/${brandId}/wines`);
      if (res.ok) setLinkedWines((await res.json()) as LinkedWine[]);
      else setLinkedWines([]);
    } catch {
      setLinkedWines([]);
    }
  };

  const openDetail = (brand: Brand) => {
    setSelectedBrand(brand);
    setEditForm({ ...brand });
    setIsNew(false);
    setValidation(null);
    setViewMode("detail");
    if (brand.brand_code && brand.id) loadLinkedWines(brand.id);
    else setLinkedWines([]);
  };

  const openNew = () => {
    setSelectedBrand(null);
    setEditForm({ brand_name_kr: "", brand_name_en: "", brand_code: "" });
    setIsNew(true);
    setLinkedWines([]);
    setViewMode("detail");
  };

  const backToList = () => {
    setViewMode("list");
    if (listDirty) {
      p.onListReload();
      setListDirty(false);
    }
  };

  const updateField = (field: string, value: unknown) =>
    setEditForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!editForm.brand_name_kr?.trim()) {
      p.showToast("브랜드 한글명은 필수입니다");
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const res = await fetch("/api/admin/brands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editForm),
        });
        if (res.ok) {
          const created = await res.json();
          p.showToast("브랜드가 생성되었습니다");
          setSelectedBrand(created);
          setEditForm({ ...created });
          setIsNew(false);
          setListDirty(true);
        } else {
          p.showToast("생성 실패");
        }
      } else if (selectedBrand) {
        const res = await fetch(`/api/admin/brands/${selectedBrand.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editForm),
        });
        if (res.ok) {
          const updated = await res.json();
          p.showToast("저장되었습니다");
          setSelectedBrand(updated);
          setEditForm({ ...updated });
          setListDirty(true);
        } else {
          p.showToast("저장 실패");
        }
      }
    } catch {
      p.showToast("오류가 발생했습니다");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selectedBrand || !confirm("정말 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/admin/brands/${selectedBrand.id}`, { method: "DELETE" });
    if (res.ok) {
      p.showToast("삭제되었습니다");
      setViewMode("list");
      p.onListReload();
    }
  };

  const handleResearch = async () => {
    if (!editForm.brand_name_kr?.trim()) {
      p.showToast("브랜드 한글명을 먼저 입력하세요");
      return;
    }
    setResearching(true);
    setValidation(null);
    try {
      const res = await fetch("/api/admin/brands/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_name_kr: editForm.brand_name_kr,
          brand_name_en: editForm.brand_name_en || "",
          country: editForm.country || "",
          website: editForm.website || "",
        }),
      });
      if (res.ok) {
        const { result, validation: v }: { result: BrandResearchResult; validation: BrandValidation } =
          await res.json();
        setValidation(v);
        const merged = { ...editForm };
        // 빈 필드만 AI 결과로 채움
        const keys: (keyof BrandResearchResult)[] = [
          "brand_name_en", "country", "region", "website", "description",
          "history", "winemaking_philosophy", "certifications", "founded_year",
          "owner", "winemaker", "vineyard_info", "annual_production", "key_wines",
          "awards", "logo_url", "image_url",
        ];
        for (const k of keys) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (!(merged as any)[k] && result[k]) (merged as any)[k] = result[k];
        }
        merged.ai_researched = true;
        setEditForm(merged);

        const confidenceMsg =
          v.confidence >= 90
            ? `신뢰도 ${v.confidence}%`
            : v.confidence >= 70
              ? `신뢰도 ${v.confidence}% — 일부 미확인 정보`
              : `신뢰도 ${v.confidence}% — 주의: 정보 확인 필요`;
        p.showToast(`AI 조사 완료 (${confidenceMsg})`);
      } else {
        const err = await res.json();
        p.showToast(`AI 조사 실패: ${err.error || "알 수 없는 오류"}`);
      }
    } catch {
      p.showToast("AI 조사 중 오류가 발생했습니다");
    }
    setResearching(false);
  };

  // 로고만 별도 추출 (공식 웹사이트 도메인 기반)
  const handleExtractLogo = async () => {
    if (!editForm.website?.trim()) {
      p.showToast("로고 추출은 '웹사이트' URL이 필요합니다");
      return;
    }
    setExtractingLogo(true);
    try {
      const res = await fetch("/api/admin/brands/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website: editForm.website, brand_name_en: editForm.brand_name_en || "" }),
      });
      const json = await res.json();
      if (res.ok && json.logo_url) {
        updateField("logo_url", json.logo_url);
        // 기존 브랜드면 추출 즉시 DB에 저장 (별도 저장 클릭 불필요)
        if (!isNew && selectedBrand?.id) {
          const sv = await fetch(`/api/admin/brands/${selectedBrand.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ logo_url: json.logo_url }),
          });
          if (sv.ok) {
            const updated = await sv.json();
            setSelectedBrand(updated);
            setEditForm((prev) => ({ ...prev, logo_url: updated.logo_url }));
            setListDirty(true);
            p.showToast(json.warning ? `저장됨 — ${json.warning}` : "로고 추출 + 저장 완료");
          } else {
            p.showToast("로고는 추출했으나 저장 실패 — 저장 버튼을 눌러주세요");
          }
        } else {
          p.showToast(json.warning || "로고를 불러왔습니다. 저장하면 반영됩니다");
        }
      } else {
        p.showToast(json.error || "로고를 찾지 못했습니다");
      }
    } catch {
      p.showToast("로고 추출 중 오류가 발생했습니다");
    }
    setExtractingLogo(false);
  };

  // 파일 직접 업로드 (kind: logo | image)
  const handleUploadFile = async (file: File, kind: "logo" | "image") => {
    setUploading(true);
    try {
      let key = editForm.brand_code || String(selectedBrand?.id || "brand");
      if (editForm.website) {
        try {
          const u = new URL(editForm.website.startsWith("http") ? editForm.website : `https://${editForm.website}`);
          key = u.hostname.replace(/^www\./, "");
        } catch { /* keep fallback */ }
      }
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      fd.append("key", String(key));
      const res = await fetch("/api/admin/brands/logo", { method: "POST", body: fd });
      const json = await res.json();
      if (res.ok && json.url) {
        const field = kind === "image" ? "image_url" : "logo_url";
        updateField(field, json.url);
        if (!isNew && selectedBrand?.id) {
          const sv = await fetch(`/api/admin/brands/${selectedBrand.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [field]: json.url }),
          });
          if (sv.ok) {
            const updated = await sv.json();
            setSelectedBrand(updated);
            setEditForm((prev) => ({ ...prev, [field]: updated[field] }));
            setListDirty(true);
            p.showToast("업로드 + 저장 완료");
          } else {
            p.showToast("업로드했으나 저장 실패 — 저장 버튼을 눌러주세요");
          }
        } else {
          p.showToast("업로드 완료 — 저장하면 반영됩니다");
        }
      } else {
        p.showToast(json.error || "업로드 실패");
      }
    } catch {
      p.showToast("업로드 중 오류가 발생했습니다");
    }
    setUploading(false);
  };

  return {
    viewMode,
    selectedBrand, editForm, updateField,
    saving, researching, extractingLogo, uploading,
    linkedWines, isNew, validation,
    openDetail, openNew, backToList,
    handleSave, handleDelete, handleResearch, handleExtractLogo, handleUploadFile,
  };
}
