import { supabase } from "@/app/lib/db";
import type { PreloadedScoringData } from "@/app/lib/weightedScoring";
import { normTight, stripQtyAndUnit } from "./normalize";

/* ================= UI 학습 체크 (Exact 자동확정용) ================= */

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

    // ✅ 거래처별 학습 우선, 전역('*') 폴백
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

    // 1) Exact
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

/* ================= 캐시 기반 학습 매칭 (DB 조회 없음) ================= */

export function getLearnedMatchCached(
  rawInput: string,
  clientCode: string | undefined,
  allAliases: PreloadedScoringData['itemAliases'],
): LearnedMatch {
  const inputItem = stripQtyAndUnit(rawInput);
  const nInputItem = normTight(inputItem);

  let rows = clientCode
    ? allAliases.filter(r => r.client_code === clientCode || r.client_code === '*' || !r.client_code)
    : [];

  if (!rows.length) {
    rows = [...allAliases].sort((a, b) => (b.count || 0) - (a.count || 0));
  }

  if (!rows.length) return null;

  const pairs = rows
    .map(r => {
      const aliasItem = stripQtyAndUnit(r.alias);
      return {
        aliasItem,
        nAliasItem: normTight(aliasItem),
        canonical: String(r.canonical || "").trim(),
      };
    })
    .filter(x => x.nAliasItem && x.canonical)
    .sort((a, b) => b.nAliasItem.length - a.nAliasItem.length);

  for (const p of pairs) {
    if (p.nAliasItem === nInputItem) {
      return { kind: "exact", alias: p.aliasItem, canonical: p.canonical };
    }
  }

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
