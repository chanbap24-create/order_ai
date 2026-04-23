import { supabase } from "@/app/lib/db";
import { stripQtyAndUnit, normTight } from "./normalize";

type AliasRow = { alias: string; canonical: string };

/**
 * contains_specific 판정 기준: 토큰 >= 3 또는 tight길이 >= 12일 때만 "구체"로 인정.
 * 상위 alias 오매칭 방지.
 */
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

export async function getLearnedMatch(rawInput: string): Promise<LearnedMatch> {
  const inputItem = stripQtyAndUnit(rawInput);
  const nInputItem = normTight(inputItem);

  const { data: rows } = await supabase
    .from("item_alias")
    .select("alias, canonical");
  if (!rows?.length) return null;

  const pairs = (rows as AliasRow[])
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
}
