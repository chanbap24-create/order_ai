import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

export const runtime = 'nodejs';

// GitHub Release URL
const GITHUB_RELEASE_URL = 'https://github.com/chanbap24-create/order_ai/releases/download/note';
const INDEX_URL = `${GITHUB_RELEASE_URL}/tasting-notes-index.json`;

// 메모리 캐시 (5분)
let indexCache: any = null;
let cacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000;

/**
 * 테이스팅 노트 조회
 * GET /api/tasting-notes
 *
 * 우선순위:
 * 1. GitHub Release PDF 인덱스 (공식 테이스팅 노트)
 * 2. Supabase tasting_notes DB (AI 리서치 fallback)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const itemNo = searchParams.get('item_no');

    // 특정 품목번호 조회
    if (itemNo) {
      // 1) GitHub Release PDF 인덱스 확인 (우선)
      await ensureIndexLoaded();

      if (indexCache?.notes) {
        const note = indexCache.notes[itemNo];
        if (note?.exists) {
          const baseUrl = indexCache.base_url || GITHUB_RELEASE_URL;
          const pdfUrl = `${baseUrl}/${note.filename}`;
          return NextResponse.json({
            success: true,
            source: 'pdf',
            item_no: itemNo,
            wine_name: note.wine_name,
            pdf_url: pdfUrl,
            size_kb: note.size_kb,
            pages: note.pages,
            updated_at: indexCache.updated_at
          });
        }
      }

      // 2) Supabase tasting_notes DB 확인 (fallback)
      const { data: dbNote } = await supabase
        .from('tasting_notes')
        .select('id, wine_id, color_note, nose_note, palate_note, food_pairing, glass_pairing, serving_temp, awards, winemaking, winery_description, vintage_note, aging_potential, wine_type, country, region, grape_varieties, supply_price, updated_at')
        .eq('wine_id', itemNo)
        .maybeSingle();

      if (dbNote && (dbNote.color_note || dbNote.nose_note || dbNote.palate_note)) {
        return NextResponse.json({
          success: true,
          source: 'db',
          item_no: itemNo,
          tasting_note: dbNote,
          updated_at: dbNote.updated_at,
        });
      }

      // 둘 다 없음
      return NextResponse.json({
        success: false,
        error: '해당 품목의 테이스팅 노트가 없습니다.',
        item_no: itemNo
      }, { status: 404 });
    }

    // 전체 목록 조회 - PDF + DB 합산
    await ensureIndexLoaded();

    const pdfNotes = indexCache?.notes || {};
    const pdfSet = new Set(
      Object.entries(pdfNotes)
        .filter(([, v]: [string, any]) => v?.exists)
        .map(([k]: [string, any]) => k)
    );

    const { data: dbNotes } = await supabase
      .from('tasting_notes')
      .select('wine_id')
      .or('color_note.neq.,nose_note.neq.,palate_note.neq.');

    const dbSet = new Set((dbNotes || []).map((n: any) => n.wine_id));

    const allItems = new Set([...pdfSet, ...dbSet]);

    return NextResponse.json({
      success: true,
      total_count: allItems.size,
      pdf_count: pdfSet.size,
      db_count: dbSet.size,
      updated_at: indexCache?.updated_at,
      notes: indexCache?.notes,
    });

  } catch (error: any) {
    console.error('Tasting notes API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '테이스팅 노트 조회 중 오류가 발생했습니다.',
        details: error.message
      },
      { status: 500 }
    );
  }
}

/** GitHub 인덱스 캐시 로드 */
async function ensureIndexLoaded() {
  const now = Date.now();
  if (indexCache && now - cacheTime <= CACHE_DURATION) return;

  try {
    const response = await fetch(INDEX_URL, { next: { revalidate: 300 } });
    if (!response.ok) throw new Error(`Failed: ${response.status}`);
    indexCache = await response.json();
    cacheTime = now;
  } catch (error: any) {
    if (!indexCache) {
      console.error('Failed to load tasting notes index:', error.message);
    }
  }
}
