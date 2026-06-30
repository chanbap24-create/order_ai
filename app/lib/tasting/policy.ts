// 거래처별 시음주 정책 + 이달 사용량 집계.
import { supabase } from "@/app/lib/db";

export type SelectionMode = "recommend" | "manual" | "monthly";

export interface TastingPolicy {
  client_code: string;
  client_type: "wine" | "glass";
  enabled: boolean;
  monthly_qty_limit: number;
  monthly_amount_limit: number | null;
  selection_mode: SelectionMode;
}

export const DEFAULT_POLICY: Omit<TastingPolicy, "client_code" | "client_type"> = {
  enabled: false,
  monthly_qty_limit: 2,
  monthly_amount_limit: null,
  selection_mode: "recommend",
};

export async function getTastingPolicy(
  clientCode: string,
  clientType: "wine" | "glass",
): Promise<TastingPolicy> {
  const { data } = await supabase
    .from("client_tasting_policy")
    .select("*")
    .eq("client_code", clientCode)
    .eq("client_type", clientType)
    .maybeSingle();
  if (!data) return { client_code: clientCode, client_type: clientType, ...DEFAULT_POLICY };
  return data as TastingPolicy;
}

export async function upsertTastingPolicy(
  p: Partial<TastingPolicy> & { client_code: string; client_type: "wine" | "glass" },
  updatedBy?: string,
): Promise<void> {
  const { error } = await supabase
    .from("client_tasting_policy")
    .upsert(
      { ...p, updated_at: new Date().toISOString(), updated_by: updatedBy ?? null },
      { onConflict: "client_code,client_type" },
    );
  if (error) throw new Error(error.message);
}

/** 이번 달(KST) 시음주 사용량 — 병수 + 금액(공급가 합). */
export async function getMonthlyTastingUsage(clientCode: string): Promise<{ qty: number; amount: number }> {
  const ym = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 7); // YYYY-MM
  const start = `${ym}-01T00:00:00+09:00`;
  const { data } = await supabase
    .from("saved_quotes")
    .select("items, total_supply")
    .eq("client_code", clientCode)
    .eq("is_tasting", true)
    .gte("created_at", start);
  let qty = 0;
  let amount = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const q of (data || []) as any[]) {
    const items = Array.isArray(q.items) ? q.items : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const it of items) qty += Number((it as any).quantity) || 0;
    amount += Number(q.total_supply) || 0;
  }
  return { qty, amount };
}

export interface TastingHistoryRow {
  id: number;
  created_at: string;
  supply: number;
  item_name: string;
}

/** 거래처 시음주 이력(최신순). 와인명은 첫 항목에서 추출. */
export async function getTastingHistory(clientCode: string, limit = 24): Promise<TastingHistoryRow[]> {
  const { data } = await supabase
    .from("saved_quotes")
    .select("id, created_at, total_supply, items")
    .eq("client_code", clientCode)
    .eq("is_tasting", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data || []) as any[]).map((q) => {
    const items = Array.isArray(q.items) ? q.items : [];
    const it = items[0] || {};
    return {
      id: Number(q.id),
      created_at: String(q.created_at),
      supply: Number(q.total_supply) || 0,
      item_name: String(it.product_name || it.item_code || ""),
    };
  });
}
