"use client";

import type { TastingNote, Wine } from "@/app/types/wine";
import type { EditForm, EditFormKey } from "../types";
import { VERIFICATION_STATUSES } from "../constants";
import { FormRow, FormTextarea, SectionTitle } from "./FormInputs";

type Props = {
  selectedWine: Wine;
  tastingNote: TastingNote | null;
  editForm: EditForm;
  updateField: (k: EditFormKey, v: string) => void;
  saving: boolean;
  generatingPpt: boolean;
  onSave: () => void;
  onGeneratePpt: () => void;
};

export function TastingNoteForm(p: Props) {
  const hasAnyValue = Object.values(p.editForm).some((v) => v);
  if (!p.tastingNote && !hasAnyValue) return null;

  return (
    <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
      <h4 style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 14 }}>
        조사 결과 {p.tastingNote?.ai_generated ? "(AI 생성)" : ""}
        {p.tastingNote?.verification_status &&
          (() => {
            const vs = VERIFICATION_STATUSES[p.tastingNote?.verification_status || ""];
            return vs ? (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 10,
                  background: vs.bg,
                  color: vs.color,
                  fontWeight: 600,
                }}
              >
                {vs.label}
              </span>
            ) : null;
          })()}
      </h4>

      {p.tastingNote?.verification_status === "warning" && (
        <Banner
          bg="#fef3c7"
          border="#fbbf24"
          color="#92400e"
          bold="생산자 확인 필요"
          rest={` - AI 조사 결과의 생산자가 원본(${p.selectedWine.supplier || p.selectedWine.supplier_kr || "미등록"})과 다를 수 있습니다.`}
        />
      )}
      {p.tastingNote?.verification_status === "mismatch" && (
        <Banner
          bg="#fee2e2"
          border="#f87171"
          color="#991b1b"
          bold="생산자 불일치"
          rest=" - 다른 생산자의 와인이 조사되었습니다. 재조사가 필요합니다."
        />
      )}

      <SectionTitle title="기본 와인 정보" />
      <FormRow label="품종" value={p.editForm.grape_varieties} onChange={(v) => p.updateField("grape_varieties", v)} />
      <FormRow label="산지" value={p.editForm.region} onChange={(v) => p.updateField("region", v)} />
      <FormRow label="알코올" value={p.editForm.alcohol} onChange={(v) => p.updateField("alcohol", v)} placeholder="예: 13.5%" />
      <FormRow label="서빙온도" value={p.editForm.serving_temp} onChange={(v) => p.updateField("serving_temp", v)} placeholder="예: 16-18°C" />

      <SectionTitle title="와이너리 / 양조" />
      <FormTextarea label="와이너리 소개" value={p.editForm.winery_description} onChange={(v) => p.updateField("winery_description", v)} />
      <FormTextarea label="양조 방법" value={p.editForm.winemaking} onChange={(v) => p.updateField("winemaking", v)} rows={3} />
      <FormTextarea label="빈티지 특성" value={p.editForm.vintage_note} onChange={(v) => p.updateField("vintage_note", v)} />

      <SectionTitle title="테이스팅 노트" />
      <FormTextarea label="컬러/외관" value={p.editForm.color_note} onChange={(v) => p.updateField("color_note", v)} />
      <FormTextarea label="노즈/향" value={p.editForm.nose_note} onChange={(v) => p.updateField("nose_note", v)} rows={3} />
      <FormTextarea label="팔렛/맛" value={p.editForm.palate_note} onChange={(v) => p.updateField("palate_note", v)} rows={3} />

      <SectionTitle title="페어링 / 기타" />
      <FormTextarea label="푸드 페어링" value={p.editForm.food_pairing} onChange={(v) => p.updateField("food_pairing", v)} />
      <FormRow label="글라스 페어링" value={p.editForm.glass_pairing} onChange={(v) => p.updateField("glass_pairing", v)} placeholder="예: 보르도 글라스" />
      <FormTextarea label="수상 내역" value={p.editForm.awards} onChange={(v) => p.updateField("awards", v)} />
      <FormRow label="숙성 잠재력" value={p.editForm.aging_potential} onChange={(v) => p.updateField("aging_potential", v)} placeholder="예: 5-10년 숙성 가능" />

      <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button
            onClick={p.onSave}
            disabled={p.saving}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: 6,
              border: "none",
              fontSize: 14,
              cursor: "pointer",
              background: p.saving ? "#9ca3af" : "#2563eb",
              color: "#fff",
              fontWeight: 600,
            }}
          >
            {p.saving ? "저장 중..." : "저장"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={p.onGeneratePpt}
            disabled={p.generatingPpt || !p.tastingNote}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              background: p.generatingPpt ? "#fef3c7" : p.tastingNote ? "#fff" : "#f3f4f6",
              fontSize: 13,
              cursor: p.tastingNote && !p.generatingPpt ? "pointer" : "not-allowed",
              color: p.tastingNote ? "#374151" : "#d1d5db",
              fontWeight: 600,
            }}
          >
            {p.generatingPpt ? "PPT 생성중..." : !p.tastingNote ? "PPT (조사 필요)" : "PPT 다운로드"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Banner({
  bg,
  border,
  color,
  bold,
  rest,
}: {
  bg: string;
  border: string;
  color: string;
  bold: string;
  rest: string;
}) {
  return (
    <div
      style={{
        padding: "10px 14px",
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 8,
        marginBottom: 14,
        fontSize: 13,
        color,
      }}
    >
      <b>{bold}</b>
      {rest}
    </div>
  );
}
