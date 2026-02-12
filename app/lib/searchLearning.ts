// app/lib/searchLearning.ts
import { supabase } from "@/app/lib/db";

/** search_key: 띄어쓰기/기호/수량/단위/따옴표 제거 + 소문자 */
export function normalizeForSearch(raw: string) {
  let s = String(raw || "");
  s = s.replace(/\r/g, "").replace(/\t/g, " ");
  s = s.replace(/["'`]/g, "");
  s = s.replace(/\b(\d+)\s*(병|박스|cs|box|bt|btl|ea|pcs|case|케이스)\b/gi, " ");
  s = s.replace(/\b(\d+)\b/g, " ");
  s = s.replace(/[()\-_/.,:;|\\[\]{}<>!?~@#$%^&*=+]/g, " ");
  s = s.toLowerCase().replace(/\s+/g, " ").trim();
  s = s.replace(/\s+/g, "");
  return s;
}

export function ensureSearchLearningTable() {
  // no-op: 테이블은 Supabase migration에서 생성됨
}

/** 후보 클릭 시 누적 */
export async function upsertSearchLearning(rawInput: string, itemNo: string) {
  ensureSearchLearningTable();

  const key = normalizeForSearch(rawInput);
  const item_no = String(itemNo || "").trim();
  if (!key || !item_no) return { ok: false, reason: "empty" };

  // upsert: hit_count + 1
  const { data: existing } = await supabase
    .from("search_learning")
    .select("hit_count")
    .eq("search_key", key)
    .eq("item_no", item_no)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("search_learning")
      .update({ hit_count: existing.hit_count + 1, last_used_at: new Date().toISOString() })
      .eq("search_key", key)
      .eq("item_no", item_no);
  } else {
    await supabase
      .from("search_learning")
      .insert({ search_key: key, item_no, hit_count: 1 });
  }

  return { ok: true, changes: 1, search_key: key };
}

/**
 * resolve 단계에서 보너스 조회
 * - exact key + contains (양방향)
 */
export async function getSearchLearningBonuses(rawInput: string, limit = 30) {
  ensureSearchLearningTable();

  const qkey = normalizeForSearch(rawInput);
  if (!qkey || qkey.length < 6) return [];

  // 1) exact
  const { data: exact } = await supabase
    .from("search_learning")
    .select("item_no, hit_count")
    .eq("search_key", qkey)
    .order("hit_count", { ascending: false })
    .limit(limit);

  // 2) contains — Postgres LIKE
  const { data: like } = await supabase
    .from("search_learning")
    .select("item_no, hit_count")
    .or(`search_key.like.%${qkey}%,search_key.like.%${qkey}%`)
    .order("hit_count", { ascending: false })
    .limit(limit);

  const map = new Map<string, number>();
  for (const r of [...(exact || []), ...(like || [])]) {
    const prev = map.get(String(r.item_no)) ?? 0;
    map.set(String(r.item_no), Math.max(prev, Number(r.hit_count || 0)));
  }

  const out = Array.from(map.entries()).map(([item_no, hit]) => {
    const h = Math.max(1, hit);
    const bonus = Math.min(0.35, 0.10 + Math.log1p(h) * 0.08);
    return { item_no, hit_count: h, bonus };
  });

  out.sort((a, b) => b.bonus - a.bonus);
  return out;
}
