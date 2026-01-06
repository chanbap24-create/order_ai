import { db } from "@/app/lib/db";

/* ================= 공통 정규화 ================= */
function normLocal(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[()\-_/.,]/g, " ");
}

function normTight(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()\-_/.,]/g, "");
}

function stripQtyAndUnit(raw: string) {
  let s = String(raw || "").trim();
  s = s.replace(/\b(\d+)\s*(병|박스|cs|box|bt|btl|개)\b/gi, "").trim();
  s = s.replace(/\b\d+\b\s*$/g, "").trim();
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function norm(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()\-_/.,]/g, "");
}

function scoreItem(q: string, name: string) {
  const a = norm(q);
  const b = norm(name);
  if (!a || !b) return 0;
  if (a === b) return 1.0;
  if (b.includes(a) || a.includes(b)) return 0.9;

  const aset = new Set(a.split(""));
  let common = 0;
  for (const ch of aset) if (b.includes(ch)) common++;
  return Math.min(0.89, common / Math.max(6, a.length));
}

/* ================= Glass 코드 추출 ================= */
// RD 0447/07 → 0447/07
function extractRDCode(itemName: string): string | null {
  const m = String(itemName || "").match(/RD\s+(\d{4}\/\d{1,2}[A-Z]?)/i);
  return m ? m[1] : null;
}

/* ================= 메인: Glass 전용 ================= */
export function resolveGlassItemsByClient(
  clientCode: string,
  items: Array<{ name: string; qty: number; code?: string }>,
  opts?: { minScore?: number; minGap?: number; topN?: number }
) {
  const minScore = opts?.minScore ?? 0.55;
  const minGap = opts?.minGap ?? 0.15;
  const topN = opts?.topN ?? 5;

  // ✅ Glass 거래처 이력 후보 (glass_client_item_stats 테이블 사용)
  const clientRows = db
    .prepare(
      `SELECT item_no, item_name
       FROM glass_client_item_stats
       WHERE client_code = ?`
    )
    .all(clientCode) as Array<{ item_no: string; item_name: string }>;

  return items.map((it) => {
    // ✅ 1순위: 코드가 있으면 코드로 정확히 매칭
    if (it.code) {
      const codeMatch = clientRows.find((r) => {
        const rdCode = extractRDCode(r.item_name);
        return rdCode && rdCode.toLowerCase() === it.code!.toLowerCase();
      });

      if (codeMatch) {
        return {
          ...it,
          normalized_query: it.code,
          resolved: true,
          item_no: codeMatch.item_no,
          item_name: codeMatch.item_name,
          score: 1.0,
          method: "exact_code",
          candidates: [
            {
              item_no: codeMatch.item_no,
              item_name: codeMatch.item_name,
              score: 1.0,
            },
          ],
          suggestions: [
            {
              item_no: codeMatch.item_no,
              item_name: codeMatch.item_name,
              score: 1.0,
            },
          ],
        };
      }
    }

    // ✅ 2순위: 품목명 기반 점수 매칭
    const q = norm(stripQtyAndUnit(it.name));

    let scored = clientRows
      .map((r) => {
        const score = scoreItem(q, r.item_name);
        return { item_no: r.item_no, item_name: r.item_name, score };
      })
      .sort((a, b) => b.score - a.score);

    let top = scored[0];
    let second = scored[1];

    let resolved =
      !!top && top.score >= minScore && (!second || top.score - second.score >= minGap);

    if (resolved) {
      return {
        ...it,
        normalized_query: q,
        resolved: true,
        item_no: top.item_no,
        item_name: top.item_name,
        score: Number(top.score.toFixed(3)),
        method: "match",
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
      };
    }

    return {
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
    };
  });
}
