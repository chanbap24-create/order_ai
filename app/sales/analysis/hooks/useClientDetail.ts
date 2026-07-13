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
    (async () => {
      setDetailLoading(true);
      const statsParams = new URLSearchParams({ code: client.client_code });
      if (filters?.type) statsParams.set("type", filters.type);
      if (filters?.startDate) statsParams.set("start", filters.startDate);
      if (filters?.endDate) statsParams.set("end", filters.endDate);
      if (filters?.manager) statsParams.set("manager", filters.manager);
      // 거래처 조회에도 type 전달 — 글라스 거래처는 glass_clients 경로로 조회해야 정보(주소·업종 등)가 나옴.
      const clientParams = new URLSearchParams({ search: client.client_code, limit: "1" });
      const clientTypeHint = filters?.type || client.client_type;
      if (clientTypeHint) clientParams.set("type", clientTypeHint);

      setPrefsLoading(true);
      // type 전달 — 와인·글라스 코드공간이 독립이라 코드만으로는 법인 오인 가능
      const prefParams = new URLSearchParams({ code: client.client_code });
      if (clientTypeHint) prefParams.set("type", clientTypeHint);
      fetch(`/api/sales/clients/preferences?${prefParams}`)
        .then((r) => r.json())
        .then((data) => {
          if (!data.error) setPrefs(data);
        })
        .catch((err) => console.error("Preferences load error:", err))
        .finally(() => setPrefsLoading(false));

      try {
        const [clientJson, statsJson] = await Promise.all([
          fetch(`/api/sales/clients?${clientParams}`).then((r) => r.json()),
          fetch(`/api/sales/clients/stats?${statsParams}`).then((r) => r.json()),
        ]);
        if (clientJson.clients?.[0]) setClientDetail(clientJson.clients[0]);
        if (statsJson.totalSales !== undefined) setDetailStats(statsJson);
      } catch (err) {
        console.error("Failed to load client detail:", err);
      } finally {
        setDetailLoading(false);
      }
    })();
  }, [client.client_code, client.client_type, filters?.type, filters?.startDate, filters?.endDate, filters?.manager]);

  const quickSetImportance = async (n: number) => {
    try {
      await fetch("/api/sales/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_code: client.client_code, importance: n, client_type: clientDetail?.client_type || client.client_type }),
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
        body: JSON.stringify({ client_code: client.client_code, ...editData, client_type: clientDetail.client_type || client.client_type }),
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
