"use client";

import { normalizeVintage } from "../lib/vintage";

type Props = {
  selectedItemNo: string;
  selectedWineName: string;
  dbTastingNote: any;
  dbWineInfo: any;
  originalPdfUrl: string;
  onDownload: (url: string, filename: string) => void;
};

/**
 * DB 저장된 테이스팅노트를 카드 형태로 렌더.
 * 와인정보(산지/품종/빈티지) + Color/Nose/Palate/Potential + 푸드 페어링 + 수상 내역.
 */
export function TastingNoteDbCard({
  selectedItemNo,
  selectedWineName,
  dbTastingNote: tn,
  dbWineInfo: wi,
  originalPdfUrl,
  onDownload,
}: Props) {
  const nameKr = (wi?.item_name_kr || selectedWineName || "").replace(/^[A-Za-z]{2}\s+/, "");
  const nameEn = wi?.item_name_en || "";
  const country = wi?.country_en || tn.country || "";
  const region = wi?.region || tn.region || "";
  const grapes = wi?.grape_varieties || tn.grape_varieties || "";
  const vintage = wi?.vintage || "";
  const alcohol = wi?.alcohol || "";
  const wineryTag = (tn.winery_description || "").split(".")[0]?.trim() || "";
  const awards = tn.awards && tn.awards !== "N/A" ? tn.awards : "";

  return (
    <div style={{ width: "100%", height: "100%", overflow: "auto", padding: "4px 0" }}>
      {originalPdfUrl && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            maxWidth: 600,
            margin: "0 auto 6px auto",
            padding: "0 8px",
          }}
        >
          <DownloadBtn bg="var(--action)" onClick={() => onDownload(originalPdfUrl, `${selectedItemNo}.pdf`)}>
            PDF
          </DownloadBtn>
          <DownloadBtn
            bg="#1a1a2e"
            onClick={() =>
              onDownload(originalPdfUrl.replace(".pdf", ".pptx"), `${selectedItemNo}.pptx`)
            }
          >
            PPTX
          </DownloadBtn>
        </div>
      )}

      <div
        style={{
          maxWidth: 600,
          margin: "0 auto",
          background: "#fff",
          borderRadius: 10,
          overflow: "hidden",
          border: "1px solid #E0D5C8",
          boxShadow: "0 2px 12px rgba(90,21,21,0.08)",
        }}
      >
        {wineryTag && (
          <div style={{ padding: "10px 16px 0", fontSize: 11, color: "#8A8A8A", lineHeight: 1.4 }}>
            {wineryTag}
          </div>
        )}
        <div style={{ margin: "8px 16px 0", height: 2, background: "#722F37" }} />
        <div style={{ margin: "2px 16px 0", height: 1, background: "#D4C4A8" }} />

        <div
          style={{
            margin: "12px 16px 0",
            padding: "12px 16px",
            background: "#F9F3F4",
            borderRadius: 8,
            border: "1px solid #E0D5C8",
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 700, color: "#5A252C", lineHeight: 1.35 }}>
            {nameKr}
          </div>
          {nameEn && (
            <div style={{ fontSize: 13, color: "#5A5A5A", fontStyle: "italic", marginTop: 4 }}>
              {nameEn}
            </div>
          )}
        </div>

        <div style={{ padding: "12px 16px 0", display: "flex", flexDirection: "column", gap: 8 }}>
          {(country || region) && (
            <Badge label="지역">{region ? `${country}, ${region}` : country}</Badge>
          )}
          {grapes && <Badge label="품종">{grapes}</Badge>}
          {vintage && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <Tag>빈티지</Tag>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#722F37" }}>
                {normalizeVintage(vintage)}
              </span>
              {tn.vintage_note && (
                <span style={{ fontSize: 11, color: "#5A5A5A", lineHeight: 1.4, marginTop: 2 }}>
                  {tn.vintage_note}
                </span>
              )}
            </div>
          )}
        </div>

        {tn.winemaking && (
          <div style={{ padding: "12px 16px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Tag>양조</Tag>
            </div>
            <div style={{ fontSize: 12.5, color: "#2C2C2C", lineHeight: 1.6 }}>
              {tn.winemaking}
              {alcohol && <span style={{ color: "#5A5A5A" }}>{"\n"}알코올: {alcohol}</span>}
            </div>
          </div>
        )}

        <div
          style={{
            margin: "14px 16px 0",
            padding: "14px 16px",
            background: "#F6EFF0",
            borderRadius: 8,
            border: "1px solid #E0D5C8",
          }}
        >
          <span
            style={{
              padding: "2px 14px",
              borderRadius: 4,
              background: "#722F37",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.05em",
            }}
          >
            TASTING NOTE
          </span>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Color", value: tn.color_note },
              { label: "Nose", value: tn.nose_note },
              { label: "Palate", value: tn.palate_note },
              { label: "Potential", value: tn.aging_potential },
            ]
              .filter((x) => x.value)
              .map((x, i) => (
                <div key={i}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#722F37",
                      fontStyle: "italic",
                      marginBottom: 2,
                    }}
                  >
                    {x.label}
                  </div>
                  <div style={{ fontSize: 12.5, color: "#2C2C2C", lineHeight: 1.6 }}>{x.value}</div>
                </div>
              ))}
          </div>
        </div>

        {tn.food_pairing && (
          <div style={{ padding: "12px 16px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Tag>푸드 페어링</Tag>
              {tn.serving_temp && (
                <span style={{ fontSize: 11, color: "#8A8A8A" }}>{tn.serving_temp}</span>
              )}
            </div>
            <div style={{ fontSize: 12.5, color: "#2C2C2C", lineHeight: 1.6 }}>
              {tn.food_pairing}
            </div>
          </div>
        )}

        {awards && (
          <div
            style={{
              margin: "12px 16px 0",
              padding: "8px 12px",
              borderTop: "1px solid #D4C4A8",
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#B8976A",
                letterSpacing: "0.05em",
              }}
            >
              AWARDS
            </span>
            <span style={{ fontSize: 12, color: "#2C2C2C", marginLeft: 8 }}>{awards}</span>
          </div>
        )}

        <div style={{ margin: "10px 16px 0", height: 2, background: "#722F37" }} />
        <div style={{ height: 1, margin: "2px 16px 0", background: "#D4C4A8" }} />
        <div style={{ padding: "8px 16px 12px", fontSize: 10, color: "#8A8A8A" }}>
          T. 02-786-3136 | www.cavedevin.com
        </div>
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: "2px 10px",
        borderRadius: 4,
        background: "#722F37",
        color: "#fff",
        fontSize: 11,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}

function Badge({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Tag>{label}</Tag>
      <span style={{ fontSize: 13, color: "#2C2C2C" }}>{children}</span>
    </div>
  );
}

function DownloadBtn({
  bg,
  onClick,
  children,
}: {
  bg: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 12px",
        borderRadius: 5,
        border: "none",
        background: bg,
        color: "white",
        fontWeight: 600,
        fontSize: "0.7rem",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
