import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { handleApiError } from "@/app/lib/errors";
import { validateRequest, safeParseBody, parseOrderSchema } from "@/app/lib/validation";
import { logger } from "@/app/lib/logger";
import { jsonResponse } from "@/app/lib/api-response";
import type { ParseOrderRequest, ParseOrderResponse, ParseOrderLineResult } from "@/app/types/api";
import type { ClientItemStatsRow } from "@/app/types/db";

export const runtime = "nodejs";

function splitLines(text: string) {
  return (text || "")
    .replaceAll("／", "/")
    .replaceAll("/", "\n")
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);
}

function extractQty(line: string): number | null {
  const m = line.match(/(\d+)\s*(병|btl|bt)?\s*$/i);
  return m ? Number(m[1]) : null;
}

function norm(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()\-_/.,]/g, "");
}

function score(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1.0;
  if (a.includes(b) || b.includes(a)) return 0.9;

  const grams = (x: string) => {
    const out = new Set<string>();
    for (let i = 0; i < x.length - 1; i++) out.add(x.slice(i, i + 2));
    return out;
  };

  const A = grams(a), B = grams(b);
  let common = 0;
  for (const g of B) if (A.has(g)) common++;
  return common / Math.max(1, Math.max(A.size, B.size));
}

export async function POST(req: Request): Promise<NextResponse<ParseOrderResponse>> {
  try {
    const rawBody = await safeParseBody(req);
    const { clientCode, orderText } = validateRequest(parseOrderSchema, rawBody) as ParseOrderRequest;

    const candidates = db.prepare(`
      SELECT item_no, item_name, last_ship_date, buy_count, avg_price
      FROM client_item_stats
      WHERE client_code = ?
      ORDER BY last_ship_date DESC, buy_count DESC
      LIMIT 200
    `).all(clientCode) as ClientItemStatsRow[];

    const lines = splitLines(orderText);

    const results: ParseOrderLineResult[] = lines.map(raw => {
      const qty = extractQty(raw);
      const rawN = norm(raw.replace(/\d+/g, ""));

      const scored = candidates
        .map(c => ({
          item_no: c.item_no,
          item_name: c.item_name,
          avg_price: c.avg_price,
          s: score(rawN, norm(c.item_name)),
        }))
        .sort((a, b) => b.s - a.s)
        .slice(0, 3);

      const top = scored[0];

      if (top && top.s >= 0.85) {
        return {
          raw,
          qty,
          status: "matched" as const,
          item_no: top.item_no,
          item_name: top.item_name,
          unit_price_hint: top.avg_price ?? null,
          candidates: [],
        };
      }

      return {
        raw,
        qty,
        status: "needs_review" as const,
        item_no: null,
        item_name: "확인필요",
        unit_price_hint: null,
        candidates: scored.map(x => ({ item_no: x.item_no, item_name: x.item_name, score: x.s })),
      };
    });

    const response: ParseOrderResponse = {
      client_code: clientCode,
      lines: results,
    };

    return jsonResponse(response);
  } catch (error) {
    logger.error("parse-order error", error);
    return handleApiError<ParseOrderResponse>(error);
  }
}
