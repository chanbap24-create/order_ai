"use client";

import { useState } from "react";
import type { SelectedRankClient } from "../types";
import { useClientDetail } from "../hooks/useClientDetail";
import RecommendTab from "../../components/RecommendTab";
import { ClientDetailHeader } from "./ClientDetailHeader";
import { ClientContactCard } from "./ClientContactCard";
import { SalesStatusCard } from "./SalesStatusCard";
import { PreferenceCharts } from "./PreferenceCharts";
import { ClientTagsCard } from "./ClientTagsCard";

type Props = {
  client: SelectedRankClient;
  currentManager: string;
  isAdmin: boolean;
  onBack: () => void;
};

export function ClientDetailPanel({ client, currentManager, isAdmin, onBack }: Props) {
  const [subTab, setSubTab] = useState<"info" | "recommend">("info");
  const detail = useClientDetail(client);

  return (
    <div>
      <ClientDetailHeader
        client={client}
        importance={detail.importance}
        quickSetImportance={detail.quickSetImportance}
        onBack={onBack}
      />

      <div style={{ display: "flex", gap: 0, marginBottom: 16 }}>
        {([["info", "거래처 정보"], ["recommend", "AI 추천"]] as const).map(([id, label]) => {
          const active = subTab === id;
          return (
            <button
              key={id}
              onClick={() => setSubTab(id)}
              style={{
                flex: 1,
                padding: "10px 0",
                border: "none",
                borderBottom: `2px solid ${active ? "var(--action)" : "#eee"}`,
                background: active ? "#5A151508" : "transparent",
                color: active ? "var(--action)" : "#999",
                fontSize: 14,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {subTab === "info" && (
        <>
          {detail.detailLoading ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>로딩 중...</div>
          ) : (
            <>
              {detail.clientDetail && (
                <ClientContactCard
                  client={detail.clientDetail}
                  editMode={detail.editMode}
                  setEditMode={detail.setEditMode}
                  editData={detail.editData}
                  setEditData={detail.setEditData}
                  onSave={detail.handleSave}
                />
              )}

              <SalesStatusCard stats={detail.detailStats} />

              <PreferenceCharts prefs={detail.prefs} loading={detail.prefsLoading} />

              {detail.clientDetail && <ClientTagsCard client={detail.clientDetail} />}
            </>
          )}
        </>
      )}

      {subTab === "recommend" && (
        <RecommendTab
          currentManager={currentManager}
          isAdmin={isAdmin}
          preselectedClient={{
            client_code: client.client_code,
            client_name: client.client_name,
            importance: detail.importance,
            manager: client.manager || undefined,
            business_type: client.business_type || undefined,
          }}
        />
      )}
    </div>
  );
}
