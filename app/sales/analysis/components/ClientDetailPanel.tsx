"use client";

import { useState } from "react";
import type { AnalysisFilters, SelectedRankClient } from "../types";
import { useClientDetail } from "../hooks/useClientDetail";
import RecommendQuoteTab from "../../components/RecommendQuoteTab";
import { ClientDetailHeader } from "./ClientDetailHeader";
import { ClientContactCard } from "./ClientContactCard";
import { SalesStatusCard } from "./SalesStatusCard";
import { PreferenceCharts } from "./PreferenceCharts";
import { ClientTagsCard } from "./ClientTagsCard";
import { ConversionCard } from "./ConversionCard";
import { ClientSavedQuotes } from "./ClientSavedQuotes";
import { ClientTastingCard } from "./ClientTastingCard";

type Props = {
  client: SelectedRankClient;
  currentManager: string;
  isAdmin: boolean;
  filters?: AnalysisFilters;
  onBack: () => void;
};

export function ClientDetailPanel({ client, currentManager, isAdmin, filters, onBack }: Props) {
  const [subTab, setSubTab] = useState<"info" | "quotes" | "recommend">("info");
  const detail = useClientDetail(client, filters);

  return (
    <div>
      <ClientDetailHeader
        client={client}
        importance={detail.importance}
        quickSetImportance={detail.quickSetImportance}
        onBack={onBack}
      />

      <div style={{ display: "flex", gap: 0, marginBottom: 16 }}>
        {([["info", "거래처 정보"], ["quotes", "견적서"], ["recommend", "추천 견적"]] as const).map(([id, label]) => {
          const active = subTab === id;
          return (
            <button
              key={id}
              onClick={() => setSubTab(id)}
              style={{
                flex: 1,
                padding: "10px 0",
                border: "none",
                borderBottom: `2px solid ${active ? "var(--action)" : "var(--gray-200)"}`,
                background: active ? "#5A151508" : "transparent",
                color: active ? "var(--action)" : "var(--neutral-100)",
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

              <SalesStatusCard stats={detail.detailStats} filters={filters} />

              <ConversionCard clientCode={client.client_code} type={filters?.type ?? "wine"} />

              <ClientTastingCard
                clientCode={client.client_code}
                clientName={client.client_name}
                clientType={filters?.type ?? client.client_type ?? "wine"}
                manager={client.manager ?? currentManager}
              />

              <PreferenceCharts prefs={detail.prefs} loading={detail.prefsLoading} />

              {detail.clientDetail && <ClientTagsCard client={detail.clientDetail} />}
            </>
          )}
        </>
      )}

      {subTab === "quotes" && (
        <ClientSavedQuotes
          clientCode={client.client_code}
          manager={isAdmin ? "" : currentManager}
        />
      )}

      {subTab === "recommend" && (
        <RecommendQuoteTab
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
