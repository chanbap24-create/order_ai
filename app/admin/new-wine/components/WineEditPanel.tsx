"use client";

import type { useWineDetail } from "../hooks/useWineDetail";
import { ImageSection } from "./ImageSection";
import { InfoRow } from "./FormInputs";
import { TastingNoteForm } from "./TastingNoteForm";

type Props = {
  detail: ReturnType<typeof useWineDetail>;
  generatingPpt: boolean;
  onGeneratePpt: (itemCode: string) => void;
};

export function WineEditPanel({ detail, generatingPpt, onGeneratePpt }: Props) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 320,
        overflowY: "auto",
        background: "#fff",
        borderRadius: 8,
        border: "1px solid #e5e7eb",
      }}
    >
      {!detail.selectedWine ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "#9ca3af",
            fontSize: 15,
          }}
        >
          좌측에서 와인을 선택하세요
        </div>
      ) : (
        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>
              {detail.selectedWine.item_name_kr}
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px 20px",
                fontSize: 13,
              }}
            >
              <InfoRow label="품번" value={detail.selectedWine.item_code} />
              <InfoRow
                label="국가"
                value={detail.selectedWine.country || detail.selectedWine.country_en || "-"}
              />
              <InfoRow
                label="공급가"
                value={
                  detail.selectedWine.supply_price != null
                    ? `₩${detail.selectedWine.supply_price.toLocaleString()}`
                    : "-"
                }
              />
              <InfoRow label="와인타입" value={detail.selectedWine.wine_type || "-"} />
              <InfoRow label="빈티지" value={detail.selectedWine.vintage || "-"} />
              <InfoRow
                label="용량"
                value={detail.selectedWine.volume_ml ? `${detail.selectedWine.volume_ml}ml` : "-"}
              />
            </div>
          </div>

          <ImageSection
            wine={detail.selectedWine}
            imageUrlInput={detail.imageUrlInput}
            setImageUrlInput={detail.setImageUrlInput}
            imageUrlExpanded={detail.imageUrlExpanded}
            setImageUrlExpanded={detail.setImageUrlExpanded}
            savingImageUrl={detail.savingImageUrl}
            onSave={detail.saveImageUrl}
          />

          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#374151",
                  whiteSpace: "nowrap",
                }}
              >
                영문명
              </label>
              <input
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 16,
                }}
                placeholder="English wine name..."
                value={detail.engNameInput}
                onChange={(e) => detail.setEngNameInput(e.target.value)}
              />
              <button
                onClick={detail.saveEngName}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  background: "#f9fafb",
                  fontSize: 13,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                저장
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <button
                onClick={detail.doResearch}
                disabled={detail.researching || !detail.engNameInput.trim()}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 6,
                  border: "none",
                  fontSize: 14,
                  cursor: "pointer",
                  background: detail.researching
                    ? "#9ca3af"
                    : !detail.engNameInput.trim()
                      ? "#d1d5db"
                      : "#7c3aed",
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                {detail.researching
                  ? "🔄 Claude AI 조사 중..."
                  : !detail.engNameInput.trim()
                    ? "영문명을 먼저 입력하세요"
                    : "🤖 AI 조사 시작"}
              </button>
              {detail.tastingNote && (
                <button
                  onClick={detail.doResearch}
                  disabled={detail.researching || !detail.engNameInput.trim()}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    background: "#fff",
                    fontSize: 13,
                    cursor: "pointer",
                    color: !detail.engNameInput.trim() ? "#d1d5db" : "#6b7280",
                  }}
                >
                  재조사
                </button>
              )}
            </div>
          </div>

          <TastingNoteForm
            selectedWine={detail.selectedWine}
            tastingNote={detail.tastingNote}
            editForm={detail.editForm}
            updateField={detail.updateField}
            saving={detail.saving}
            generatingPpt={generatingPpt}
            onSave={detail.handleSave}
            onGeneratePpt={() =>
              detail.selectedWine && onGeneratePpt(detail.selectedWine.item_code)
            }
          />
        </div>
      )}
    </div>
  );
}
