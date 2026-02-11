// GET /api/admin/wines/all - 전체 와인 목록 (페이지네이션, 검색, 필터)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { ensureWineTables } from "@/app/lib/wineDb";
import { handleApiError } from "@/app/lib/errors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    ensureWineTables();
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const country = url.searchParams.get("country") || "";
    const statusFilter = url.searchParams.get("statusFilter") || ""; // new, active, discontinued
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(200, Math.max(10, parseInt(url.searchParams.get("limit") || "50", 10)));
    const offset = (page - 1) * limit;

    let where = "WHERE 1=1";
    const params: unknown[] = [];

    if (search) {
      where += " AND (w.item_code LIKE ? OR w.item_name_kr LIKE ? OR w.item_name_en LIKE ? OR w.country LIKE ? OR w.country_en LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }
    if (country) {
      where += " AND (w.country = ? OR w.country_en = ?)";
      params.push(country, country);
    }
    if (statusFilter) {
      where += " AND w.status = ?";
      params.push(statusFilter);
    }

    // 전체 카운트
    const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM wines w ${where}`).get(...params) as { cnt: number };

    // 국가 목록 (필터용)
    const countries = db.prepare(`
      SELECT COALESCE(country_en, country) as name, COUNT(*) as cnt
      FROM wines
      WHERE COALESCE(country_en, country) IS NOT NULL AND COALESCE(country_en, country) != ''
      GROUP BY COALESCE(country_en, country)
      ORDER BY cnt DESC
    `).all() as { name: string; cnt: number }[];

    // 데이터
    const wines = db.prepare(`
      SELECT w.*, tn.id as tasting_note_id, tn.ai_generated, tn.approved
      FROM wines w
      LEFT JOIN tasting_notes tn ON w.item_code = tn.wine_id
      ${where}
      ORDER BY w.updated_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, Math.floor(limit), Math.floor(offset));

    return NextResponse.json({
      success: true,
      data: wines,
      total: countRow.cnt,
      page,
      limit,
      totalPages: Math.ceil(countRow.cnt / limit),
      countries,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
