"use client";

import type { PreviewRow, VehicleInfo } from "../types";

type Props = {
  open: boolean;
  onClose: () => void;
  selectedSheet: string;
  previewRows: PreviewRow[];
  vehicleInfo: VehicleInfo | null;
  onDeleteRow: (rowNum: number) => void;
};

export function PreviewPanel(p: Props) {
  if (!p.open) return null;

  const totalAmount = p.previewRows.reduce((sum, r) => {
    const n = Number(r.cells[3]?.replace(/,/g, ""));
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  return (
    <>
      <div
        onClick={p.onClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.3)",
          zIndex: 9998,
          transition: "opacity 0.2s ease",
        }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "90vw",
          maxWidth: 520,
          background: "#fff",
          zIndex: 9999,
          boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
          display: "flex",
          flexDirection: "column",
          animation: "slideIn 0.25s ease",
        }}
      >
        <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-default)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
              {p.selectedSheet} 현황
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--action)", marginTop: 4 }}>
              총 {totalAmount.toLocaleString()}원
            </div>
          </div>
          <button
            onClick={p.onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 22,
              color: "var(--text-tertiary)",
              cursor: "pointer",
              padding: "0 4px",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                {["사용일자", "계정과목", "사용내역", "금액", "비고"].map((h, i) => (
                  <th
                    key={i}
                    style={{
                      padding: "8px 6px",
                      textAlign: i === 3 ? "right" : "left",
                      borderBottom: "2px solid rgba(90,21,21,0.1)",
                      color: "var(--text-tertiary)",
                      fontWeight: 600,
                      fontSize: 10,
                      position: "sticky",
                      top: 0,
                      background: "#fff",
                      whiteSpace: "nowrap",
                      width: i === 4 ? 28 : undefined,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.previewRows.map((r, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? "#fff" : "var(--surface-muted)" }}>
                  {r.cells.map((cell, ci) => (
                    <td
                      key={ci}
                      style={{
                        padding: "6px",
                        borderBottom: "1px solid var(--border-subtle)",
                        textAlign: ci === 3 ? "right" : "left",
                        color: "var(--text-primary)",
                        whiteSpace: "nowrap",
                        maxWidth: ci === 2 ? 160 : 100,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {ci === 3 && cell && !isNaN(Number(cell))
                        ? Number(cell).toLocaleString()
                        : cell}
                    </td>
                  ))}
                  <td
                    style={{
                      padding: "4px 2px",
                      borderBottom: "1px solid var(--border-subtle)",
                      textAlign: "center",
                    }}
                  >
                    <button
                      onClick={() => p.onDeleteRow(r.rowNum)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--status-danger)",
                        cursor: "pointer",
                        fontSize: 14,
                        padding: 0,
                        lineHeight: 1,
                      }}
                      title="삭제"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {p.previewRows.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: 40,
                color: "var(--text-tertiary)",
                fontSize: 13,
              }}
            >
              데이터가 없습니다
            </div>
          )}

          {p.vehicleInfo && (
            <div
              style={{
                marginTop: 20,
                padding: "14px 16px",
                borderRadius: 10,
                background: "var(--surface-muted)",
                border: "1px solid var(--action-muted)",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>
                차량비
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  fontSize: 12,
                }}
              >
                <VehicleField label="차량번호" value={p.vehicleInfo.carNo} />
                <VehicleField label="총운행" value={`${p.vehicleInfo.totalKm.toLocaleString()} km`} />
                <VehicleField
                  label="총주유량"
                  value={p.vehicleInfo.totalLiter ? `${p.vehicleInfo.totalLiter.toLocaleString()} L` : "-"}
                />
                <VehicleField
                  label="주유금액"
                  value={`${p.vehicleInfo.totalFuel.toLocaleString()}원`}
                  valueColor="var(--action)"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function VehicleField({
  label,
  value,
  valueColor = "var(--text-primary)",
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div>
      <span style={{ color: "var(--text-tertiary)" }}>{label}</span>
      <div style={{ fontWeight: 600, color: valueColor, marginTop: 2 }}>{value}</div>
    </div>
  );
}
