import { supabase } from "@/app/lib/db";
import { normTight, stripQtyAndUnit } from "./normalize";

/* ================= 약어 학습 시스템 ================= */

type AliasRow = { alias: string; canonical: string };

export function isSpecificAlias(alias: string) {
  const a = stripQtyAndUnit(alias);
  const tokens = a.split(" ").filter(Boolean);
  const tightLen = normTight(a).length;
  return tokens.length >= 3 || tightLen >= 12;
}

export type LearnedMatch =
  | { kind: "exact"; alias: string; canonical: string }
  | { kind: "contains_specific"; alias: string; canonical: string }
  | { kind: "contains_weak"; alias: string; canonical: string }
  | null;

export async function getLearnedMatch(
  rawInput: string,
  clientCode?: string,
): Promise<LearnedMatch> {
  try {
    const inputItem = stripQtyAndUnit(rawInput);
    const nInputItem = normTight(inputItem);
    if (!nInputItem) return null;

    // 거래처별 학습 우선, 전역('*') 폴백
    let rows: AliasRow[] = [];
    if (clientCode) {
      const { data } = await supabase
        .from('item_alias')
        .select('alias, canonical')
        .or(`client_code.eq.${clientCode},client_code.eq.*`);
      rows = (data || []) as AliasRow[];
    }
    if (!rows?.length) {
      const { data } = await supabase
        .from('item_alias')
        .select('alias, canonical')
        .order('count', { ascending: false });
      rows = (data || []) as AliasRow[];
    }
    if (!rows?.length) return null;

    const pairs = rows
      .map((r) => {
        const aliasItem = stripQtyAndUnit(r.alias);
        return {
          aliasItem,
          nAliasItem: normTight(aliasItem),
          canonical: String(r.canonical || "").trim(),
        };
      })
      .filter((x) => x.nAliasItem && x.canonical)
      .sort((a, b) => b.nAliasItem.length - a.nAliasItem.length);

    // 1) Exact 우선
    for (const p of pairs) {
      if (p.nAliasItem === nInputItem) {
        return { kind: "exact", alias: p.aliasItem, canonical: p.canonical };
      }
    }

    // 2) Contains
    for (const p of pairs) {
      if (nInputItem.includes(p.nAliasItem)) {
        if (isSpecificAlias(p.aliasItem)) {
          return { kind: "contains_specific", alias: p.aliasItem, canonical: p.canonical };
        }
        return { kind: "contains_weak", alias: p.aliasItem, canonical: p.canonical };
      }
    }

    return null;
  } catch {
    return null;
  }
}
