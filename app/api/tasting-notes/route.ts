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
 * 1. Supabase tasting_notes DB (HTML 렌더링 → 깔끔한 인라인 뷰)
 * 2. GitHub Release PDF (iframe fallback)
 * DB 소스일 때도 PDF/PPTX 다운로드 URL 함께 반환
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const itemNo = searchParams.get('item_no');
    // refresh=1 시 메모리 캐시 + fetch 캐시 모두 무효화 (업로드 직후 즉시 반영용)
    const forceRefresh = searchParams.get('refresh') === '1';

    // 특정 품목번호 조회
    if (itemNo) {
      // GitHub 인덱스도 백그라운드로 로드 (PDF 다운로드 URL 제공용)
      await ensureIndexLoaded(forceRefresh);

      let pdfUrl: string | undefined;
      if (indexCache?.notes) {
        const pdfNote = indexCache.notes[itemNo];
        if (pdfNote?.exists) {
          const baseUrl = indexCache.base_url || GITHUB_RELEASE_URL;
          pdfUrl = `${baseUrl}/${pdfNote.filename}?v=${Date.now()}`;
        }
      }

      // 1) GitHub Release PDF 우선 (원본 그대로 표시)
      if (pdfUrl) {
        return NextResponse.json({
          success: true,
          source: 'pdf',
          item_no: itemNo,
          pdf_url: pdfUrl,
          updated_at: indexCache?.updated_at,
        });
      }

      // 2) Supabase tasting_notes DB fallback (PDF 없을 때 HTML 렌더링)
      const { data: dbNote } = await supabase
        .from('tasting_notes')
        .select('id, wine_id, color_note, nose_note, palate_note, food_pairing, glass_pairing, serving_temp, awards, winemaking, winery_description, vintage_note, aging_potential, wine_type, country, region, grape_varieties, supply_price, updated_at')
        .eq('wine_id', itemNo)
        .maybeSingle();

      if (dbNote && (dbNote.color_note || dbNote.nose_note || dbNote.palate_note)) {
        // 와인 기본정보도 함께 조회 (원본 레이아웃 렌더링용)
        const { data: wineInfo } = await supabase
          .from('wines')
          .select('item_code, item_name_kr, item_name_en, vintage, country, country_en, region, grape_varieties, alcohol, image_url, brand')
          .eq('item_code', itemNo)
          .maybeSingle();

        return NextResponse.json({
          success: true,
          source: 'db',
          item_no: itemNo,
          tasting_note: dbNote,
          wine_info: wineInfo || null,
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
    await ensureIndexLoaded(forceRefresh);

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

/** GitHub 인덱스 캐시 로드. force=true 면 메모리·fetch 캐시 모두 우회. */
async function ensureIndexLoaded(force = false) {
  const now = Date.now();
  if (!force && indexCache && now - cacheTime <= CACHE_DURATION) return;

  try {
    // force 시 cache-buster query + no-store 로 GitHub CDN/Next fetch 캐시 모두 우회
    const url = force ? `${INDEX_URL}?ts=${now}` : INDEX_URL;
    const response = await fetch(
      url,
      force ? { cache: 'no-store' } : { next: { revalidate: 300 } },
    );
    if (!response.ok) throw new Error(`Failed: ${response.status}`);
    indexCache = await response.json();
    cacheTime = now;
  } catch (error: any) {
    if (!indexCache) {
      console.error('Failed to load tasting notes index:', error.message);
    }
  }
}
