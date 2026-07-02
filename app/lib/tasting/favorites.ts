// 시음주 즐겨찾기(담당자별): 여러 와인 등록 + 선택적 기본값 1개.
// 기본값 지정 시 시음주 선정에서 우선, 없으면 AI 추천. (기존 '이달의 시음주 1픽' 대체)
import { supabase } from "@/app/lib/db";

export interface Favorite {
  item_no: string;
  item_name: string | null;
  is_default: boolean;
}

export async function listFavorites(company: "CDV" | "DL", manager: string): Promise<Favorite[]> {
  const { data } = await supabase
    .from("tasting_favorites")
    .select("item_no, item_name, is_default")
    .eq("company", company).eq("manager", manager)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data || []) as any[]).map((r) => ({ item_no: r.item_no, item_name: r.item_name, is_default: !!r.is_default }));
}

export async function addFavorite(company: "CDV" | "DL", manager: string, itemNo: string, itemName: string): Promise<void> {
  const { error } = await supabase.from("tasting_favorites").upsert(
    { company, manager, item_no: itemNo, item_name: itemName },
    { onConflict: "company,manager,item_no", ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
}

export async function removeFavorite(company: "CDV" | "DL", manager: string, itemNo: string): Promise<void> {
  const { error } = await supabase.from("tasting_favorites").delete()
    .eq("company", company).eq("manager", manager).eq("item_no", itemNo);
  if (error) throw new Error(error.message);
}

/** 기본값 설정(itemNo) 또는 해제(null). 담당자별 기본값은 1개만. */
export async function setDefaultFavorite(company: "CDV" | "DL", manager: string, itemNo: string | null): Promise<void> {
  await supabase.from("tasting_favorites").update({ is_default: false })
    .eq("company", company).eq("manager", manager).eq("is_default", true);
  if (itemNo) {
    const { error } = await supabase.from("tasting_favorites").update({ is_default: true })
      .eq("company", company).eq("manager", manager).eq("item_no", itemNo);
    if (error) throw new Error(error.message);
  }
}

export async function getFavoriteDefault(company: "CDV" | "DL", manager: string): Promise<Favorite | null> {
  const { data } = await supabase
    .from("tasting_favorites")
    .select("item_no, item_name, is_default")
    .eq("company", company).eq("manager", manager).eq("is_default", true)
    .maybeSingle();
  return data ? { item_no: data.item_no, item_name: data.item_name, is_default: true } : null;
}
