"use client";

import type { Brand } from "@/app/types/wine";
import type { LinkedWine } from "../types";
import type { BrandValidation } from "@/app/types/wine";
import { Section, Field, TextArea } from "./FormPrimitives";
import { BrandDetailHeader } from "./BrandDetailHeader";
import { ValidationBanner } from "./ValidationBanner";
import { LinkedWinesTable } from "./LinkedWinesTable";

type Props = {
  editForm: Partial<Brand>;
  updateField: (field: string, value: unknown) => void;
  isNew: boolean;
  selectedBrand: Brand | null;
  linkedWines: LinkedWine[];
  validation: BrandValidation | null;
  saving: boolean;
  researching: boolean;
  onBack: () => void;
  onResearch: () => void;
  onDelete: () => void;
  onSave: () => void;
};

export function BrandDetailView(p: Props) {
  const f = p.editForm;
  const update = p.updateField;

  return (
    <div>
      <BrandDetailHeader
        isNew={p.isNew}
        hasSelectedBrand={!!p.selectedBrand}
        researching={p.researching}
        saving={p.saving}
        onBack={p.onBack}
        onResearch={p.onResearch}
        onDelete={p.onDelete}
        onSave={p.onSave}
      />

      <ValidationBanner v={p.validation} />

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Section title="기본 정보">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            <Field label="브랜드 코드" value={f.brand_code || ""} onChange={(v) => update("brand_code", v)} placeholder="예: RD, EM" />
            <Field label="한글명 *" value={f.brand_name_kr || ""} onChange={(v) => update("brand_name_kr", v)} placeholder="브랜드 한글명" />
            <Field label="영문명" value={f.brand_name_en || ""} onChange={(v) => update("brand_name_en", v)} placeholder="Brand English Name" />
            <Field label="국가" value={f.country || ""} onChange={(v) => update("country", v)} placeholder="France, Italy..." />
            <Field label="지역" value={f.region || ""} onChange={(v) => update("region", v)} placeholder="Bordeaux, Tuscany..." />
            <Field label="설립연도" value={f.founded_year?.toString() || ""} onChange={(v) => update("founded_year", v ? parseInt(v) : null)} placeholder="1850" type="number" />
            <Field label="웹사이트" value={f.website || ""} onChange={(v) => update("website", v)} placeholder="https://..." />
          </div>
        </Section>

        <Section title="소개">
          <TextArea label="브랜드 소개" value={f.description || ""} onChange={(v) => update("description", v)} rows={3} />
          <TextArea label="역사" value={f.history || ""} onChange={(v) => update("history", v)} rows={3} />
          <TextArea label="양조 철학" value={f.winemaking_philosophy || ""} onChange={(v) => update("winemaking_philosophy", v)} rows={3} />
        </Section>

        <Section title="생산 정보">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            <Field label="소유자" value={f.owner || ""} onChange={(v) => update("owner", v)} />
            <Field label="와인메이커" value={f.winemaker || ""} onChange={(v) => update("winemaker", v)} />
            <Field label="연간 생산량" value={f.annual_production || ""} onChange={(v) => update("annual_production", v)} />
            <Field label="인증" value={f.certifications || ""} onChange={(v) => update("certifications", v)} placeholder="유기농, 비오디나미 등" />
          </div>
          <TextArea label="포도밭 정보" value={f.vineyard_info || ""} onChange={(v) => update("vineyard_info", v)} rows={2} />
          <TextArea label="대표 와인" value={f.key_wines || ""} onChange={(v) => update("key_wines", v)} rows={2} />
          <TextArea label="수상 내역" value={f.awards || ""} onChange={(v) => update("awards", v)} rows={2} />
        </Section>

        <Section title="이미지">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            <Field label="로고 URL" value={f.logo_url || ""} onChange={(v) => update("logo_url", v)} placeholder="https://..." />
            <Field label="이미지 URL" value={f.image_url || ""} onChange={(v) => update("image_url", v)} placeholder="https://..." />
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            {f.logo_url && (
              <ImgPreview src={f.logo_url} label="로고" size={80} objectFit="contain" />
            )}
            {f.image_url && (
              <ImgPreview src={f.image_url} label="이미지" width={120} height={80} objectFit="cover" />
            )}
          </div>
        </Section>

        <Section title="메모">
          <TextArea label="메모" value={f.notes || ""} onChange={(v) => update("notes", v)} rows={3} />
        </Section>

        {!p.isNew && f.brand_code && (
          <Section title={`연결된 와인 (${p.linkedWines.length}개)`}>
            <LinkedWinesTable wines={p.linkedWines} />
          </Section>
        )}
      </div>
    </div>
  );
}

function ImgPreview({
  src,
  label,
  size,
  width,
  height,
  objectFit,
}: {
  src: string;
  label: string;
  size?: number;
  width?: number;
  height?: number;
  objectFit: "contain" | "cover";
}) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <img
        src={src}
        alt={label}
        style={{
          width: size ?? width,
          height: size ?? height,
          objectFit,
          borderRadius: 6,
          border: "1px solid rgba(90,21,21,0.08)",
        }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    </div>
  );
}
