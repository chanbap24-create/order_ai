// app/lib/suggestItems.ts
import { supabase } from "@/app/lib/db";

function norm(s: any) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()\-_/.,]/g, "");
}

function scoreName(q: string, name: string) {
  const a = norm(q);
  const b = norm(name);
  if (!a || !b) return 0;
  if (a === b) return 1.0;
  if (b.includes(a) || a.includes(b)) return 0.92;

  // 간단 문자 교집합 점수(가벼운 스코어)
  const aset = new Set(a.split(""));
  let common = 0;
  for (const ch of aset) if (b.includes(ch)) common++;
  const s = common / Math.max(6, a.length);
  return Math.max(0, Math.min(0.91, s));
}

type ItemRow = { item_no: string; item_name: string };

async function tryGetAllItems(): Promise<ItemRow[]> {
  try {
    const { data } = await supabase.from('inventory_cdv').select('item_no, item_name');
    return (data || []).map((r: any) => ({ item_no: String(r.item_no), item_name: String(r.item_name) }));
  } catch {
    return [];
  }
}

export type ItemSuggestion = {
  item_no: string;
  item_name: string;
  score: number; // 0~1
};

export async function suggestTop3Items(query: string): Promise<ItemSuggestion[]> {
  const q = String(query || "").trim();
  if (!q) return [];

  const items = await tryGetAllItems();
  if (!items.length) return [];

  return items
    .map((it) => ({
      item_no: it.item_no,
      item_name: it.item_name,
      score: scoreName(q, it.item_name),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
