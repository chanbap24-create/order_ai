import { supabase } from "@/app/lib/db";
import { applyItemSynonym } from "@/app/lib/itemsynonyms";
import { getSearchLearningBonuses } from "@/app/lib/searchLearning";

import { stripQtyAndUnit, normalizeItemName, norm, scoreItem } from "./resolve-items/normalize";
import {
  getVintageFromItemNo, hasVintageHint,
  extractVintageHint, codeToVintage, applyVintageAdjustment,
  LATEST_VINTAGE_BOOST,
} from "./resolve-items/vintage";
import { getLearnedMatch } from "./resolve-items/alias";
import { fetchFromMasterByTail } from "./resolve-items/masterFetch";
import { buildLastShippedMap, loadEnglishMap } from "./resolve-items/dbLoaders";

// 외부에서 직접 import 하는 헬퍼 보존
export { getVintageFromItemNo, hasVintageHint };

export async function resolveItemsByClient(
  clientCode: string,
  items: Array<{ name: string; qty: number }>,
  opts?: { minScore?: number; minGap?: number; topN?: number },
) {
  const minScore = opts?.minScore ?? 0.55;
  const minGap = opts?.minGap ?? 0.15;
  const topN = opts?.topN ?? 5;

  // 거래처 이력 후보 + 최근 출고일 + English 영문명: 병렬 로드
  const [clientRowsRes, lastShippedMap, englishMap] = await Promise.all([
    supabase
      .from("client_item_stats")
      .select("item_no, item_name")
      .eq("client_code", clientCode),
    buildLastShippedMap(clientCode),
    loadEnglishMap(),
  ]);
  const clientRows = (clientRowsRes.data || []) as Array<{ item_no: string; item_name: string }>;

  const results = [];
  for (const it of items) {
    const vintageHint = extractVintageHint(it.name);
    const learned = await getLearnedMatch(it.name);

    const learnedItemNo =
      learned?.canonical && /^\d+$/.test(learned.canonical) ? learned.canonical : null;

    const masterRows = await fetchFromMasterByTail(it.name, 80);

    // 영문명으로도 검색 (Christophe Pitois 같은 케이스)
    const englishRows: Array<{ item_no: string; item_name: string }> = [];
    const hasEnglish = /[A-Za-z]{3,}/.test(it.name);
    if (hasEnglish) {
      try {
        const words = it.name.match(/[A-Za-z]{3,}/g) || [];
        const allCandidates = new Map<string, { item_no: string; item_name: string }>();

        for (const word of words.slice(0, 5)) {
          const { data: enRows } = await supabase
            .from("item_english")
            .select("item_no, name_en")
            .ilike("name_en", `%${word.toLowerCase()}%`)
            .limit(20);

          if (!enRows) continue;
          for (const er of enRows) {
            const itemNo = String(er.item_no);
            if (allCandidates.has(itemNo)) continue;

            const clientRow = clientRows.find((cr) => String(cr.item_no) === itemNo);
            if (clientRow) {
              allCandidates.set(itemNo, {
                item_no: itemNo,
                item_name: String(clientRow.item_name),
              });
            }
          }
        }

        englishRows.push(...Array.from(allCandidates.values()));
      } catch (e) {
        console.error("[resolveItems] English search failed:", e);
      }
    }

    // 후보 풀 = 거래처이력 + 마스터 + 영문명 (중복 제거)
    const poolMap = new Map<string, { item_no: string; item_name: string }>();
    for (const r of clientRows) {
      poolMap.set(String(r.item_no), { item_no: String(r.item_no), item_name: String(r.item_name) });
    }
    for (const r of masterRows) {
      poolMap.set(String(r.item_no), { item_no: String(r.item_no), item_name: String(r.item_name) });
    }
    for (const r of englishRows) {
      poolMap.set(String(r.item_no), { item_no: String(r.item_no), item_name: String(r.item_name) });
    }
    const pool = Array.from(poolMap.values());

    // 1) Exact 학습이면 하드 확정
    if (learned && learned.kind === "exact" && learnedItemNo) {
      const hit = pool.find((r) => String(r.item_no) === learnedItemNo);
      if (hit) {
        results.push({
          ...it,
          normalized_query: normalizeItemName(applyItemSynonym(it.name)),
          resolved: true,
          item_no: hit.item_no,
          item_name: hit.item_name,
          score: 1.0,
          method: "alias_exact_item_no",
          candidates: [],
          suggestions: [],
        });
        continue;
      }
    }

    // 2) contains_specific 학습이면 하드 확정
    if (learned && learned.kind === "contains_specific" && learnedItemNo) {
      const hit = pool.find((r) => String(r.item_no) === learnedItemNo);
      if (hit) {
        results.push({
          ...it,
          normalized_query: normalizeItemName(applyItemSynonym(it.name)),
          resolved: true,
          item_no: hit.item_no,
          item_name: hit.item_name,
          score: 0.99,
          method: "alias_contains_specific_item_no",
          candidates: [],
          suggestions: [],
        });
        continue;
      }
    }

    // 3) 점수 기반 + contains_weak 소프트 가산점
    const synonymApplied = applyItemSynonym(it.name);
    const q = normalizeItemName(synonymApplied);
    const SOFT_BONUS = 0.15;

    // 검색 학습 보너스
    const learnedBonuses = await getSearchLearningBonuses(it.name, 30);
    const bonusMap = new Map<string, number>();
    for (const b of learnedBonuses) bonusMap.set(String(b.item_no), b.bonus);

    let scored = pool
      .map((r) => {
        const ko = scoreItem(q, r.item_name);
        const enName = englishMap.get(String(r.item_no)) || "";
        const en = enName ? scoreItem(q, enName) : 0;

        // 한글/영문 중 더 잘 맞는 것을 base로 사용
        const base = Math.max(ko, en);

        const itemVintage = codeToVintage(r.item_no);
        let finalScore = applyVintageAdjustment(base, vintageHint, itemVintage);

        if (learned && learned.kind === "contains_weak" && learnedItemNo) {
          if (String(r.item_no) === learnedItemNo) {
            finalScore = Math.min(1.0, finalScore + SOFT_BONUS);
          }
        }

        // search_learning 보너스
        const learnedBonus = bonusMap.get(String(r.item_no)) ?? 0;
        if (learnedBonus > 0) {
          finalScore = Math.min(1.0, finalScore + learnedBonus);
        }

        // 빈티지 힌트 없을 때: 최근 출고일 + 최근 빈티지 가산
        if (!hasVintageHint(it.name)) {
          const shippedAt = lastShippedMap.get(String(r.item_no));
          if (shippedAt) {
            const daysAgo = (Date.now() - shippedAt) / (1000 * 60 * 60 * 24);
            const shipBonus = Math.max(0, 0.05 - daysAgo * 0.0005);
            if (shipBonus > 0) finalScore = Math.min(1.0, finalScore + shipBonus);
          }

          const v = getVintageFromItemNo(r.item_no);
          if (v) {
            const vBonus = Math.min(0.05, (v - 2000) * 0.002);
            if (vBonus > 0) finalScore = Math.min(1.0, finalScore + vBonus);
          }
        }

        return { item_no: r.item_no, item_name: r.item_name, score: finalScore };
      })
      .sort((a, b) => b.score - a.score);

    // "같은 품목명 + 빈티지만 다름" 동점 깨기
    if (!hasVintageHint(it.name) && scored.length >= 2) {
      const N = Math.min(10, scored.length);
      const topNArr = scored.slice(0, N);

      const key = norm(topNArr[0]?.item_name || "");
      if (key) {
        const sameGroup = topNArr.filter((c) => norm(c.item_name) === key);
        if (sameGroup.length >= 2) {
          let maxV = -1;
          for (const c of sameGroup) {
            const v = getVintageFromItemNo(c.item_no) ?? codeToVintage(c.item_no) ?? -1;
            if (v > maxV) maxV = v;
          }
          if (maxV > 0) {
            const boostedTopN = topNArr.map((c) => {
              const v = getVintageFromItemNo(c.item_no) ?? codeToVintage(c.item_no) ?? -1;
              if (norm(c.item_name) === key && v === maxV) {
                return { ...c, score: Math.min(1.0, c.score + LATEST_VINTAGE_BOOST) };
              }
              return c;
            });
            scored = [...boostedTopN, ...scored.slice(N)].sort((a, b) => b.score - a.score);
          }
        }
      }
    }

    let top = scored[0];
    let second = scored[1];

    const tokenCount = stripQtyAndUnit(it.name).split(" ").filter(Boolean).length;

    let resolved =
      !!top && top.score >= minScore && (!second || top.score - second.score >= minGap);

    // 같은 그룹이면 최신 빈티지 tie-break 자동확정
    if (!hasVintageHint(it.name) && !resolved && top && second) {
      const k1 = norm(String(top.item_name || ""));
      const k2 = norm(String(second.item_name || ""));
      const sameGroup = k1 && k2 && k1 === k2;

      if (sameGroup) {
        const v1 = getVintageFromItemNo(String(top.item_no)) ?? codeToVintage(String(top.item_no));
        const v2 = getVintageFromItemNo(String(second.item_no)) ?? codeToVintage(String(second.item_no));

        if (v1 && v2 && v2 > v1) {
          const tmp = top;
          top = second;
          second = tmp;
        }
        if (top.score >= minScore) resolved = true;
      }
    }

    // contains_weak + 토큰 3개 이상은 원칙적 자동확정 금지 (예외: 매우 높은 스코어/갭)
    if (learned?.kind === "contains_weak" && tokenCount >= 3) {
      const gap = second ? top.score - second.score : 1.0;
      const allowAuto = (top.score >= 0.95 && gap >= 0.20) || (top.score >= 0.88 && gap >= 0.30);
      if (!allowAuto) resolved = false;
    }

    if (resolved) {
      results.push({
        ...it,
        normalized_query: q,
        resolved: true,
        item_no: top.item_no,
        item_name: top.item_name,
        score: Number(top.score.toFixed(3)),
        method: learned?.kind ? `match+${learned.kind}` : "match",
        candidates: scored.slice(0, topN).map((c) => ({
          item_no: c.item_no,
          item_name: c.item_name,
          score: Number(c.score.toFixed(3)),
        })),
        suggestions: scored.slice(0, Math.max(3, topN)).map((c) => ({
          item_no: c.item_no,
          item_name: c.item_name,
          score: Number(c.score.toFixed(3)),
        })),
      });
    } else {
      results.push({
        ...it,
        normalized_query: q,
        resolved: false,
        candidates: scored.slice(0, topN).map((c) => ({
          item_no: c.item_no,
          item_name: c.item_name,
          score: Number(c.score.toFixed(3)),
        })),
        suggestions: scored.slice(0, Math.max(3, topN)).map((c) => ({
          item_no: c.item_no,
          item_name: c.item_name,
          score: Number(c.score.toFixed(3)),
        })),
      });
    }
  }
  return results;
}
