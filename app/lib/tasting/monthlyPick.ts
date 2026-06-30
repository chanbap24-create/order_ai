// '이달의 시음주' 지정 조회 — 담당자 전용 우선, 없으면 법인 공통.
import { supabase } from "@/app/lib/db";

export interface MonthlyPick {
  item_no: string;
  item_name: string | null;
}

function currentYm(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 7);
}

/** 이달의 시음주 지정(담당자별, 이번 달). 기존 지정은 교체. */
export async function setMonthlyPick(
  company: "CDV" | "DL",
  manager: string,
  itemNo: string,
  itemName: string,
): Promise<void> {
  const ym = currentYm();
  await supabase.from("tasting_monthly_pick").delete().eq("ym", ym).eq("company", company).eq("manager", manager);
  const { error } = await supabase
    .from("tasting_monthly_pick")
    .insert({ ym, company, manager, item_no: itemNo, item_name: itemName });
  if (error) throw new Error(error.message);
}

export async function clearMonthlyPick(company: "CDV" | "DL", manager: string): Promise<void> {
  const ym = currentYm();
  await supabase.from("tasting_monthly_pick").delete().eq("ym", ym).eq("company", company).eq("manager", manager);
}

export async function getMonthlyPick(
  company: "CDV" | "DL",
  manager: string,
): Promise<MonthlyPick | null> {
  const ym = currentYm();
  const { data } = await supabase
    .from("tasting_monthly_pick")
    .select("item_no, item_name, manager")
    .eq("ym", ym)
    .eq("company", company);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data || []) as any[];
  if (rows.length === 0) return null;
  const pick = rows.find((r) => r.manager === manager) || rows.find((r) => !r.manager) || rows[0];
  return pick ? { item_no: pick.item_no, item_name: pick.item_name } : null;
}
