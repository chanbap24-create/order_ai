"use client";

import type React from "react";
import type {
  ActionItem,
  ActionSummary,
  MeetingReminder,
  NewArrivalMatch,
  ReorderNudge,
  SeasonRecommendation,
  StockDepletion,
  UpsellSuggestion,
  VisitSchedule,
} from "../types";
import { RISK_COLORS, RISK_LABELS, MEETING_TYPE_LABEL } from "../constants";
import { DismissButton } from "./DismissButton";

type Props = {
  visible: boolean;
  dismissedTotal: number;
  clearDismissed: () => void;
  va: ActionItem[];
  vn: ReorderNudge[];
  vm: MeetingReminder[];
  vsd: StockDepletion[];
  vu: UpsellSuggestion[];
  vna: NewArrivalMatch[];
  vvs: VisitSchedule[];
  vsr: SeasonRecommendation[];
  hasAnyData: boolean;
  summary: ActionSummary;
  dismissItem: (key: string, e?: React.MouseEvent) => void;
  onExpandDetails: () => void;
};

export function CompactBriefing(p: Props) {
  if (!p.visible) return null;

  return (
    <div
      style={{
        background: "var(--gray-50)",
        borderRadius: 12,
        border: "1px solid var(--action-muted)",
        padding: "16px",
        marginBottom: 16,
        fontSize: 13,
        color: "#333",
        lineHeight: 1.8,
      }}
    >
      {p.dismissedTotal > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
            paddingBottom: 8,
            borderBottom: "1px solid var(--action-muted)",
          }}
        >
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {p.dismissedTotal}건 확인 처리됨
          </span>
          <button
            onClick={p.clearDismissed}
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            초기화
          </button>
        </div>
      )}

      {p.va.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ color: "var(--status-danger)", fontWeight: 700 }}>이탈 위험 {p.va.length}건</span>
          {p.va.slice(0, 3).map((a) => (
            <div key={a.client_code} style={rowStyle}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ color: RISK_COLORS[a.risk_level], fontWeight: 600 }}>
                  {RISK_LABELS[a.risk_level]}
                </span>{" "}
                {a.client_name} — {a.days_since_last}일 미구매
                {a.revenue_change_pct < 0 && (
                  <span style={{ color: "var(--status-danger)" }}> ({Math.abs(a.revenue_change_pct)}%↓)</span>
                )}
              </span>
              <DismissButton
                variant="inline"
                onDismiss={(e) => p.dismissItem(`churn_${a.client_code}`, e)}
              />
            </div>
          ))}
          {p.va.length > 3 && <div style={moreStyle}>외 {p.va.length - 3}건</div>}
        </div>
      )}

      {p.vn.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ color: "var(--status-info)", fontWeight: 700 }}>재주문 {p.vn.length}건</span>
          <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
            {" "}(재고有 {p.vn.filter((n) => n.stock_status !== "out_of_stock").length} / 품절{" "}
            {p.vn.filter((n) => n.stock_status === "out_of_stock").length})
          </span>
          {p.vn
            .filter((n) => n.stock_status !== "out_of_stock")
            .slice(0, 3)
            .map((n) => (
              <div key={`${n.client_code}-${n.item_no}`} style={rowStyle}>
                <span style={{ ...ellipsisStyle, flex: 1, minWidth: 0 }}>
                  {n.client_name} × {n.item_name.length > 18 ? n.item_name.slice(0, 18) + "…" : n.item_name} —{" "}
                  {n.overdue_days}일 초과
                </span>
                <DismissButton
                  variant="inline"
                  onDismiss={(e) => p.dismissItem(`reorder_${n.client_code}_${n.item_no}`, e)}
                />
              </div>
            ))}
          {p.vn.filter((n) => n.stock_status !== "out_of_stock").length > 3 && (
            <div style={moreStyle}>
              외 {p.vn.filter((n) => n.stock_status !== "out_of_stock").length - 3}건
            </div>
          )}
        </div>
      )}

      {p.vm.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ color: "#6A1B9A", fontWeight: 700 }}>미팅 {p.vm.length}건</span>
          {p.vm.slice(0, 3).map((m) => (
            <div key={m.meeting_id} style={rowStyle}>
              <span style={{ flex: 1, minWidth: 0 }}>
                D-{m.days_until} {m.client_name} {MEETING_TYPE_LABEL[m.meeting_type] || m.meeting_type}
                {m.meeting_time ? ` ${m.meeting_time}` : ""}
              </span>
              <DismissButton
                variant="inline"
                onDismiss={(e) => p.dismissItem(`meeting_${m.meeting_id}`, e)}
              />
            </div>
          ))}
        </div>
      )}

      {p.vsd.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ color: "#B71C1C", fontWeight: 700 }}>재고 위험 {p.vsd.length}건</span>
          {p.vsd.slice(0, 3).map((sd) => (
            <div key={sd.item_no} style={rowStyle}>
              <span style={{ ...ellipsisStyle, flex: 1, minWidth: 0 }}>
                {sd.alert_type === "out_of_stock" ? "품절" : `잔여 ${sd.current_stock}병`}{" "}
                {sd.item_name.length > 22 ? sd.item_name.slice(0, 22) + "…" : sd.item_name}
                {sd.affected_clients.length > 0 && ` (${sd.affected_clients.length}곳)`}
              </span>
              <DismissButton
                variant="inline"
                onDismiss={(e) => p.dismissItem(`stock_${sd.item_no}`, e)}
              />
            </div>
          ))}
          {p.vsd.length > 3 && <div style={moreStyle}>외 {p.vsd.length - 3}건</div>}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "4px 16px",
          fontSize: 12,
          color: "var(--text-tertiary)",
          marginTop: 4,
        }}
      >
        {p.vu.length > 0 && (
          <span>
            <span style={{ color: "var(--status-success)", fontWeight: 600 }}>업셀</span> {p.vu.length}건
          </span>
        )}
        {p.vna.length > 0 && (
          <span>
            <span style={{ color: "#00838F", fontWeight: 600 }}>신규입고</span> {p.vna.length}건
          </span>
        )}
        {p.vvs.length > 0 && (
          <span>
            <span style={{ color: "#795548", fontWeight: 600 }}>방문</span> {p.vvs.length}건
          </span>
        )}
        {p.vsr.length > 0 && (
          <span>
            <span style={{ color: "var(--action)", fontWeight: 600 }}>
              시즌({p.summary.season_name})
            </span>{" "}
            {p.vsr.length}건
          </span>
        )}
      </div>

      {!p.hasAnyData && p.dismissedTotal > 0 && (
        <div style={{ textAlign: "center", padding: "12px 0", color: "var(--text-muted)", fontSize: 13 }}>
          모든 항목을 확인 처리했습니다.
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 12 }}>
        <button
          onClick={p.onExpandDetails}
          style={{
            padding: "6px 16px",
            borderRadius: 20,
            border: "1px solid var(--border-default)",
            background: "white",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-tertiary)",
            cursor: "pointer",
          }}
        >
          상세 보기
        </button>
      </div>
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  paddingLeft: 12,
  fontSize: 12,
  color: "#555",
};

const moreStyle: React.CSSProperties = {
  paddingLeft: 12,
  fontSize: 11,
  color: "var(--text-muted)",
};

const ellipsisStyle: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
