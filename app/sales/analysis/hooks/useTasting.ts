"use client";

import { useCallback, useEffect, useState } from "react";

export type SelectionMode = "recommend" | "manual" | "monthly";
export interface TastingPolicy {
  enabled: boolean;
  monthly_qty_limit: number;
  monthly_amount_limit: number | null;
  selection_mode: SelectionMode;
}
export interface TastingUsage {
  qty: number;
  amount: number;
}
export interface TastingHistoryRow {
  id: number;
  created_at: string;
  supply: number;
  item_name: string;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RegisterResult = { ok: boolean; reason?: string; item?: any };

/** 거래처 시음주 정책/사용량/이력 로드 + 저장/등록. */
export function useTasting(clientCode: string, clientType: string, clientName: string, manager: string) {
  const type = clientType === "glass" ? "glass" : "wine";
  const [policy, setPolicy] = useState<TastingPolicy | null>(null);
  const [usage, setUsage] = useState<TastingUsage | null>(null);
  const [history, setHistory] = useState<TastingHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!clientCode) return;
    try {
      const res = await fetch(`/api/sales/tasting/policy?client_code=${encodeURIComponent(clientCode)}&type=${type}`);
      const d = await res.json();
      if (!d.error) {
        setPolicy(d.policy);
        setUsage(d.usage);
        setHistory(d.history || []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [clientCode, type]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const savePolicy = useCallback(
    async (patch: Partial<TastingPolicy>) => {
      await fetch("/api/sales/tasting/policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_code: clientCode, client_type: type, ...patch }),
      });
      await load();
    },
    [clientCode, type, load],
  );

  const register = useCallback(
    async (opts: { mode?: SelectionMode; item_no?: string; force?: boolean } = {}): Promise<RegisterResult> => {
      setBusy(true);
      try {
        const res = await fetch("/api/sales/tasting/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_code: clientCode, client_type: type, client_name: clientName, manager, ...opts }),
        });
        const d = await res.json();
        await load();
        return d as RegisterResult;
      } catch (e) {
        return { ok: false, reason: e instanceof Error ? e.message : "등록 실패" };
      } finally {
        setBusy(false);
      }
    },
    [clientCode, type, clientName, manager, load],
  );

  return { policy, usage, history, loading, busy, savePolicy, register };
}
