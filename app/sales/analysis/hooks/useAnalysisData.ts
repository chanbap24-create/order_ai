import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalysisType, ClientRankItem, ClientRankStats, SuggestionItem } from "../types";

type Params = {
  currentManager: string;
  isAdmin: boolean;
};

const KST_NOW_DATE = () =>
  new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
const KST_MONTH_START = () => KST_NOW_DATE().slice(0, 8) + "01";

/**
 * AnalysisSection의 모든 state + 데이터 로드 로직 집약.
 * type / manager / department / client / dateRange / data / clientRanking 전체 관리.
 */
export function useAnalysisData(p: Params) {
  const [type, setType] = useState<AnalysisType>("wine");
  const [filters, setFilters] = useState<{ managers: string[]; departments: string[] }>({
    managers: [],
    departments: [],
  });
  const [dateRange, setDateRange] = useState<{ min: string; max: string } | null>(null);
  const [manager, setManager] = useState(p.isAdmin ? "" : p.currentManager);
  const [department, setDepartment] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientCode, setClientCode] = useState("");
  const [clientName, setClientName] = useState("");

  const [startDate, setStartDate] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("analysis_startDate") || KST_MONTH_START();
    }
    return KST_MONTH_START();
  });
  const [endDate, setEndDate] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("analysis_endDate") || KST_NOW_DATE();
    }
    return KST_NOW_DATE();
  });
  const [preset, setPreset] = useState("");

  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [rankClients, setRankClients] = useState<ClientRankItem[]>([]);
  const [rankStats, setRankStats] = useState<Record<string, ClientRankStats>>({});
  const [rankLoading, setRankLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("analysis_startDate", startDate);
      sessionStorage.setItem("analysis_endDate", endDate);
    }
  }, [startDate, endDate]);

  // ── 담당자/부서/날짜 범위 로드 (type 변경 시) ──
  useEffect(() => {
    fetch(`/api/analysis/client?filters=1&type=${type}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setFilters({ managers: d.managers || [], departments: d.departments || [] });
          if (d.dateRange) setDateRange(d.dateRange);
        }
      });
  }, [type]);

  // ── 거래처 검색 자동완성 ──
  const handleClientSearch = useCallback(
    (val: string) => {
      setClientSearch(val);
      setClientCode("");
      setClientName("");
      if (suggestTimer.current) clearTimeout(suggestTimer.current);
      if (val.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      suggestTimer.current = setTimeout(() => {
        fetch(`/api/analysis/client?suggest=${encodeURIComponent(val)}&type=${type}`)
          .then((r) => r.json())
          .then((d) => {
            if (d.success) {
              setSuggestions(d.clients || []);
              setShowSuggestions(true);
            }
          });
      }, 300);
    },
    [type],
  );

  const selectClient = (c: SuggestionItem) => {
    setClientCode(c.code);
    setClientName(c.name);
    setClientSearch(c.name);
    setShowSuggestions(false);
  };

  // ── 거래처 순위 로드 ──
  const fetchClientRanking = useCallback(async () => {
    setRankLoading(true);
    try {
      const mgr = p.isAdmin ? manager : p.currentManager;
      const clientParams = new URLSearchParams({ type, limit: "9999" });
      if (mgr) clientParams.set("manager", mgr);
      const statsParams = new URLSearchParams({ type });
      if (startDate) statsParams.set("start", startDate);
      if (endDate) statsParams.set("end", endDate);
      if (mgr) statsParams.set("manager", mgr);
      const [clientRes, statsRes] = await Promise.all([
        fetch(`/api/sales/clients?${clientParams}`),
        fetch(`/api/sales/clients/stats?${statsParams}`),
      ]);
      const clientJson = await clientRes.json();
      const statsJson = await statsRes.json();
      if (clientJson.clients) setRankClients(clientJson.clients);
      if (statsJson.stats) setRankStats(statsJson.stats);
    } catch (err) {
      console.error("Failed to fetch client ranking:", err);
    } finally {
      setRankLoading(false);
    }
  }, [type, manager, p.isAdmin, p.currentManager, startDate, endDate]);

  useEffect(() => {
    fetchClientRanking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // ── 메인 분석 데이터 로드 ──
  const loadData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("type", type);
    const mgr = p.isAdmin ? manager : p.currentManager;
    if (mgr) params.set("manager", mgr);
    if (department) params.set("department", department);
    if (clientCode) params.set("client", clientCode);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    fetch(`/api/analysis/client?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setData(d);
      })
      .finally(() => setLoading(false));
    fetchClientRanking();
  }, [
    type, manager, department, clientCode, startDate, endDate,
    p.isAdmin, p.currentManager, fetchClientRanking,
  ]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const handleTypeChange = (t: AnalysisType) => {
    setType(t);
    if (p.isAdmin) setManager("");
    setDepartment("");
    setClientSearch("");
    setClientCode("");
    setClientName("");
    setSuggestions([]);
    setShowSuggestions(false);
    setData(null);
  };

  const clearClient = () => {
    setClientCode("");
    setClientName("");
    setClientSearch("");
  };

  return {
    type, setType: handleTypeChange,
    filters, dateRange,
    manager, setManager,
    department, setDepartment,
    clientSearch, setClientSearch,
    clientCode, clientName,
    startDate, setStartDate,
    endDate, setEndDate,
    preset, setPreset,
    suggestions, showSuggestions, setShowSuggestions,
    handleClientSearch, selectClient, clearClient,
    data, loading, mounted,
    rankClients, rankStats, rankLoading,
    loadData,
  };
}
