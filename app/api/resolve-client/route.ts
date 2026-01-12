import { NextResponse } from "next/server";
import { jsonResponse } from "@/app/lib/api-response";
import { db } from "@/app/lib/db";
import { handleApiError, AppError } from "@/app/lib/errors";
import { validateRequest, safeParseBody, resolveClientSchema } from "@/app/lib/validation";
import { logger } from "@/app/lib/logger";
import { config } from "@/app/lib/config";
import type { ResolveClientRequest, ResolveClientResponse, ClientInfo } from "@/app/types/api";
import type { ClientAliasRow } from "@/app/types/db";

export const runtime = "nodejs";

function firstLineClient(text: string): string {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines[0] || "";
}

function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    // 쉼표/마침표/따옴표/특수기호 다 제거
    .replace(/[\u200b\s"'`~!@#$%^&*+=|\\{}[\]:;<>/?(),.-]/g, "")
    .replace(/(주식회사|\(주\)|주\.)/g, "");
}

function eqNorm(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  return Boolean(na && nb && na === nb);
}

function scoreName(q: string, name: string): number {
  const a = norm(q);
  const b = norm(name);
  if (!a || !b) return 0;
  if (a === b) return 1.0;
  if (b.includes(a) || a.includes(b)) return 0.9;

  const aset = new Set(a.split(""));
  let common = 0;
  for (const ch of aset) if (b.includes(ch)) common++;
  const s = common / Math.max(6, a.length);
  return Math.max(0, Math.min(0.89, s));
}

export async function POST(req: Request): Promise<NextResponse<ResolveClientResponse>> {
  try {
    const rawBody = await safeParseBody(req);
    const body = validateRequest(resolveClientSchema, rawBody) as ResolveClientRequest;

    const message = body.message ?? "";
    const client_hint = body.client_hint ?? "";
    const forceResolve = body.force_resolve ?? false;

    const candidateName = String(client_hint).trim() || firstLineClient(message);

    const rows = db
      .prepare(`SELECT client_code, alias, weight FROM client_alias`)
      .all() as ClientAliasRow[];

    // 1) 첫 줄 exact(norm) 매칭
    if (candidateName) {
      const exact = rows.find((r) => eqNorm(r.alias, candidateName));
      if (exact) {
        return jsonResponse({
          success: true,
          status: "resolved",
          client: {
            status: "resolved",
            client_code: exact.client_code,
            client_name: exact.alias,
            method: "exact_norm_firstline",
          },
        });
      }
    }

    // 2) fuzzy 후보 (weight 반영: 가산점)
    const q = candidateName || message;

    const scored = rows
      .map((r) => {
        const base = scoreName(q, r.alias);
        const w = Number(r.weight ?? 1);
        const bonus = Math.min(0.2, Math.max(0, (w - 1) * 0.02));
        const s = Math.min(1.0, base + bonus);

        return {
          client_name: r.alias,
          client_code: r.client_code,
          score: Number(s.toFixed(3)),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    const top = scored[0];
    const second = scored[1];

    // 기본 자동확정(엄격)
    const canAuto =
      top &&
      top.score >= config.matching.client.autoResolveScore &&
      (!second || top.score - second.score >= config.matching.client.autoResolveGap);

    if (canAuto) {
      return jsonResponse({
        success: true,
        status: "resolved",
        client: { status: "resolved", ...top, method: "fuzzy_auto" },
      });
    }

    // 강제 확정 모드(옵션)
    const forceOk =
      forceResolve &&
      top &&
      top.score >= config.matching.client.forceResolveMinScore &&
      (!second || top.score - second.score >= config.matching.client.forceResolveGap);

    if (forceOk) {
      return jsonResponse({
        success: true,
        status: "resolved",
        client: { status: "resolved", ...top, method: "fuzzy_force" },
      });
    }

    const response: ResolveClientResponse = {
      success: true,
      status: "needs_review_client",
      client: {
        status: "needs_review",
        score: top?.score ?? 0,
        candidates: scored,
        hint_used: candidateName,
      },
    };

    return jsonResponse(response);
  } catch (error) {
    logger.error("resolve-client error", error);
    return handleApiError<ResolveClientResponse>(error);
  }
}
