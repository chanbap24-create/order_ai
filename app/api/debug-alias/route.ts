/**
 * 별칭 디버그 API
 * 특정 별칭이 DB에 있는지 확인
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/db";
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
    const { data: allAliases } = await supabase
      .from('item_alias')
      .select('alias, canonical, count')
      .or(`alias.ilike.%${query}%,canonical.ilike.%${query}%`)
      .order('count', { ascending: false })
      .limit(20);

    // 2. 정확 매칭
    const { data: exactMatchArr } = await supabase
      .from('item_alias')
      .select('alias, canonical, count')
      .ilike('alias', query)
      .limit(1);
    const exactMatch = exactMatchArr?.[0] || null;

    // 3. 별칭 확장 테스트
    const expanded = await expandAliases(query, true);  // debug=true

    // 4. 전체 별칭 통계
    const { count: total } = await supabase
      .from('item_alias')
      .select('*', { count: 'exact', head: true });

    // 5. 상위 10개 별칭
    const { data: top10 } = await supabase
      .from('item_alias')
      .select('alias, canonical, count')
      .order('count', { ascending: false })
      .limit(10);

    return NextResponse.json({
      success: true,
      query,
      expanded,
      exactMatch,
      similarAliases: allAliases || [],
      stats: {
        total: total || 0,
        top10: top10 || [],
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
