import { useEffect, useState } from "react";
import type { AnalysisFilters, ClientDetail, DetailStats, PreferencesData, SelectedRankClient } from "../types";

/**
 * 거래처 상세 정보 + 매출 통계 + 선호 분석 로드.
 * filters 가 주어지면 stats API 에 동일 기간/매니저/타입 전달 — 랭킹 테이블 매출과 일치.
 */
export function useClientDetail(client: SelectedRankClient, filters?: AnalysisFilters) {
  const [clientDetail, setClientDetail] = useState<ClientDetail | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<ClientDetail>>({});
  const [detailStats, setDetailStats] = useState<DetailStats | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [importance, setImportance] = useState(client.importance);
  const [prefs, setPrefs] = useState<PreferencesData | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(true);

  useEffect(() => {
    setDetailLoading(true);
    const statsParams = new URLSearchParams({ code: client.client_code });
    if (filters?.type) statsParams.set("type", filters.type);
    if (filters?.startDate) statsParams.set("start", filters.startDate);
    if (filters?.endDate) statsParams.set("end", filters.endDate);
    if (filters?.manager) statsParams.set("manager", filters.manager);
    Promise.all([
      fetch(`/api/sales/clients?search=${encodeURIComponent(client.client_code)}&limit=1`).then(
        (r) => r.json(),
      ),
      fetch(`/api/sales/clients/stats?${statsParams}`).then((r) => r.json()),
    ])
      .then(([clientJson, statsJson]) => {
        if (clientJson.clients?.[0]) setClientDetail(clientJson.clients[0]);
        if (statsJson.totalSales !== undefined) setDetailStats(statsJson);
      })
      .catch((err) => console.error("Failed to load client detail:", err))
      .finally(() => setDetailLoading(false));

    setPrefsLoading(true);
    fetch(`/api/sales/clients/preferences?code=${client.client_code}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setPrefs(data);
      })
      .catch((err) => console.error("Preferences load error:", err))
      .finally(() => setPrefsLoading(false));
  }, [client.client_code, filters?.type, filters?.startDate, filters?.endDate, filters?.manager]);

  const quickSetImportance = async (n: number) => {
    try {
      await fetch("/api/sales/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_code: client.client_code, importance: n }),
      });
      setImportance(n);
      if (clientDetail) setClientDetail({ ...clientDetail, importance: n });
    } catch (err) {
      console.error("Importance update error:", err);
    }
  };

  const handleSave = async () => {
    if (!clientDetail) return;
    try {
      const res = await fetch("/api/sales/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_code: client.client_code, ...editData }),
      });
      const json = await res.json();
      if (json.success) {
        setClientDetail({ ...clientDetail, ...editData } as ClientDetail);
        setEditMode(false);
        setEditData({});
      }
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  return {
    clientDetail,
    detailStats,
    detailLoading,
    editMode, setEditMode,
    editData, setEditData,
    importance,
    prefs, prefsLoading,
    quickSetImportance,
    handleSave,
  };
}
