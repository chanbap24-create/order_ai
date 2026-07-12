"use client";

import type { TastingNote } from "@/app/types/wine";
import { DetailField, DetailSection } from "./FormInputs";
import { flavorLabel } from "@/app/api/sales/recommend/lib/flavor";

type Props = {
  tastingNote: TastingNote | null;
  show: boolean;
  setShow: (b: boolean) => void;
  hasSelectedWine: boolean;
};

export function ResearchDetailPanel(p: Props) {
  if (!p.hasSelectedWine) return null;

  if (!p.show) {
    return (
      <button
        onClick={() => p.setShow(true)}
        style={{
          writingMode: "vertical-rl",
          padding: "12px 6px",
          borderRadius: "8px",
          border: "1px solid var(--gray-300)",
          background: "#f9fafb",
          cursor: "pointer",
          fontSize: 12,
          color: "var(--gray-500)",
          fontWeight: 600,
          flexShrink: 0,
        }}
        title="상세 패널 펼치기"
      >
        ◀ 조사 상세
      </button>
    );
  }

  return (
    <div
      style={{
        width: 380,
        minWidth: 320,
        overflowY: "auto",
        background: "#fafbfc",
        borderRadius: 8,
        border: "1px solid var(--border-default)",
        flexShrink: 0,
        position: "relative",
      }}
    >
      <button
        onClick={() => p.setShow(false)}
        style={{
          position: "sticky",
          top: 8,
          float: "right",
          margin: "8px 8px 0 0",
          zIndex: 2,
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: "1px solid var(--gray-300)",
          background: "#fff",
          cursor: "pointer",
          fontSize: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        title="패널 접기"
      >
        ✕
      </button>

      {!p.tastingNote || !p.tastingNote.ai_generated ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "var(--gray-400)",
            fontSize: 14,
            padding: 40,
            textAlign: "center",
          }}
        >
          조사를 먼저 진행해주세요
        </div>
      ) : (
        <div style={{ padding: "16px 18px" }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#1e293b",
              marginBottom: 16,
            }}
          >
            AI 조사 원본 데이터
          </div>

          <DetailSection icon="🏰" title="와이너리 상세" content={p.tastingNote.winery_description} />
          <DetailSection icon="🍷" title="양조 방법 상세" content={p.tastingNote.winemaking} />
          <DetailSection icon="📅" title="빈티지 특성" content={p.tastingNote.vintage_note} />

          <DetailSection icon="🎨" title="테이스팅 노트 상세" content={null}>
            <DetailField label="컬러" value={p.tastingNote.color_note} />
            <DetailField label="노즈" value={p.tastingNote.nose_note} />
            <DetailField label="팔렛" value={p.tastingNote.palate_note} />
          </DetailSection>

          {p.tastingNote.flavor_tags && p.tastingNote.flavor_tags.length > 0 && (
            <DetailSection icon="👃" title={`향미 태그 · 추천 매칭용 (${p.tastingNote.flavor_tags.length})`} content={null}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {p.tastingNote.flavor_tags.map((t, i) => (
                  <span key={i} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 999, background: "#f6eeee", color: "var(--action)", border: "1px solid var(--action-muted)" }}>{flavorLabel(t)}</span>
                ))}
              </div>
            </DetailSection>
          )}

          <DetailSection icon="🍽️" title="페어링 상세" content={null}>
            <DetailField label="푸드 페어링" value={p.tastingNote.food_pairing} />
            <DetailField label="글라스 페어링" value={p.tastingNote.glass_pairing} />
          </DetailSection>

          <DetailSection icon="🏆" title="수상/평가" content={p.tastingNote.awards} />
          <DetailSection icon="⏳" title="숙성 잠재력" content={p.tastingNote.aging_potential} />

          {p.tastingNote.serving_temp && (
            <div
              style={{
                marginTop: 12,
                padding: "8px 12px",
                background: "#e0f2fe",
                borderRadius: 6,
                fontSize: 12,
                color: "#0369a1",
              }}
            >
              🌡️ 서빙 온도: {p.tastingNote.serving_temp}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
