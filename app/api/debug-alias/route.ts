/**
 * 별칭 디버그 API
 * 특정 별칭이 DB에 있는지 확인
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { expandAliases } from "@/app/lib/naturalLanguagePreprocessor";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("q") || "";
    
    if (!query) {
      return NextResponse.json({
        success: false,
        error: "검색어를 입력하세요 (예: ?q=클레멍)"
      });
    }
    
    // 1. 전체 별칭 검색
    const allAliases = db.prepare(`
      SELECT alias, canonical, count
      FROM item_alias
      WHERE alias LIKE ? OR canonical LIKE ?
      ORDER BY count DESC
      LIMIT 20
    `).all(`%${query}%`, `%${query}%`) as Array<{
      alias: string;
      canonical: string;
      count: number;
    }>;
    
    // 2. 정확 매칭
    const exactMatch = db.prepare(`
      SELECT alias, canonical, count
      FROM item_alias
      WHERE LOWER(alias) = LOWER(?)
    `).get(query) as { alias: string; canonical: string; count: number } | undefined;
    
    // 3. 별칭 확장 테스트
    const expanded = expandAliases(query, true);  // debug=true
    
    // 4. 전체 별칭 통계
    const stats = db.prepare(`
      SELECT COUNT(*) as total
      FROM item_alias
    `).get() as { total: number };
    
    // 5. 상위 10개 별칭
    const top10 = db.prepare(`
      SELECT alias, canonical, count
      FROM item_alias
      ORDER BY count DESC
      LIMIT 10
    `).all() as Array<{
      alias: string;
      canonical: string;
      count: number;
    }>;
    
    return NextResponse.json({
      success: true,
      query,
      expanded,
      exactMatch: exactMatch || null,
      similarAliases: allAliases,
      stats: {
        total: stats.total,
        top10,
      }
    });
    
  } catch (error) {
    console.error('별칭 디버그 에러:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
    }, { status: 500 });
  }
}
