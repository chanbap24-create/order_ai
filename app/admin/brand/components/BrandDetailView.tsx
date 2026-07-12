"use client";

import { useState } from "react";
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
  extractingLogo: boolean;
  uploading: boolean;
  onBack: () => void;
  onResearch: () => void;
  onExtractLogo: () => void;
  onUploadFile: (file: File, kind: "logo" | "image") => void;
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
            <div>
              <Field label="웹사이트" value={f.website || ""} onChange={(v) => update("website", v)} placeholder="https://..." />
              {f.website && (
                <a
                  href={/^https?:\/\//i.test(f.website) ? f.website : `https://${f.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 11, color: "var(--action)", display: "inline-block", marginTop: 4 }}
                >
                  사이트 열기 ↗
                </a>
              )}
            </div>
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <button
              type="button"
              onClick={p.onExtractLogo}
              disabled={p.extractingLogo || p.uploading || !f.website}
              title={!f.website ? "웹사이트 URL을 먼저 입력하세요" : "공식 웹사이트 도메인에서 로고 추출"}
              style={{
                fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 6,
                border: "1px solid var(--action-muted)", cursor: f.website ? "pointer" : "not-allowed",
                background: f.website ? "var(--action)" : "var(--border-subtle)",
                color: f.website ? "#fff" : "var(--text-muted)",
                opacity: p.extractingLogo ? 0.6 : 1,
              }}
            >
              {p.extractingLogo ? "로고 추출 중…" : "🔍 로고 추출"}
            </button>
            <UploadButton label="로고 업로드" busy={p.uploading} onFile={(file) => p.onUploadFile(file, "logo")} />
            <UploadButton label="이미지 업로드" busy={p.uploading} onFile={(file) => p.onUploadFile(file, "image")} />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>추출/업로드 시 자동 저장 · png 권장</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            <Field label="로고 URL" value={f.logo_url || ""} onChange={(v) => update("logo_url", v)} placeholder="https://..." />
            <Field label="이미지 URL" value={f.image_url || ""} onChange={(v) => update("image_url", v)} placeholder="https://..." />
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            {f.logo_url && (
              <ImgPreview key={f.logo_url} src={f.logo_url} label="로고" size={80} objectFit="contain" />
            )}
            {f.image_url && (
              <ImgPreview key={f.image_url} src={f.image_url} label="이미지" width={120} height={80} objectFit="cover" />
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

function UploadButton({ label, busy, onFile }: { label: string; busy: boolean; onFile: (f: File) => void }) {
  return (
    <label
      style={{
        fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 6,
        border: "1px solid var(--action-muted)", cursor: busy ? "not-allowed" : "pointer",
        background: "#fff", color: "var(--text-secondary)", opacity: busy ? 0.6 : 1,
        display: "inline-flex", alignItems: "center", gap: 4,
      }}
    >
      📁 {label}
      <input
        type="file"
        accept="image/*"
        disabled={busy}
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = ""; // 같은 파일 재선택 허용
        }}
      />
    </label>
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
  const [failed, setFailed] = useState(false);
  const w = size ?? width, h = size ?? height;
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      {failed ? (
        <div
          style={{
            width: w, height: h, borderRadius: 6, border: "1px dashed var(--border-default)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, color: "var(--text-muted)", textAlign: "center", padding: 4,
          }}
        >
          미리보기 불가
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={label}
          style={{ width: w, height: h, objectFit, borderRadius: 6, border: "1px solid var(--border-default)" }}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
