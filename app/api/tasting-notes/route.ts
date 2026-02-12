import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// GitHub Release URL
const GITHUB_RELEASE_URL = 'https://github.com/chanbap24-create/order_ai/releases/download/note';
const INDEX_URL = `${GITHUB_RELEASE_URL}/tasting-notes-index.json`;

// 메모리 캐시 (5분)
let indexCache: any = null;
let cacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000;

/**
 * 테이스팅 노트 인덱스 조회
 * GET /api/tasting-notes
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const itemNo = searchParams.get('item_no');

    // 캐시가 유효하면 재사용
    const now = Date.now();
    if (!indexCache || now - cacheTime > CACHE_DURATION) {
      console.log('📥 Loading tasting notes index from GitHub...');
      try {
        const response = await fetch(INDEX_URL, {
          next: { revalidate: 300 },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch index: ${response.status}`);
        }

        indexCache = await response.json();
        cacheTime = now;
        console.log('✅ Index loaded, items:', Object.keys(indexCache.notes || {}).length);
      } catch (error: any) {
        console.error('❌ Failed to load tasting notes index:', error.message);
        // 이전 캐시가 있으면 만료되어도 재사용
        if (indexCache) {
          console.log('⚠️ Using stale cache');
        } else {
          return NextResponse.json({
            success: false,
            error: '테이스팅 노트 데이터를 불러올 수 없습니다.',
            message: error.message
          }, { status: 404 });
        }
      }
    }

    // 특정 품목번호 조회
    if (itemNo) {
      if (!indexCache || !indexCache.notes) {
        return NextResponse.json({
          success: false,
          error: '인덱스 데이터가 로드되지 않았습니다.'
        }, { status: 500 });
      }

      const note = indexCache.notes[itemNo];
      
      if (!note || !note.exists) {
        console.log('❌ Item not found:', itemNo);
        return NextResponse.json({
          success: false,
          error: '해당 품목의 테이스팅 노트가 없습니다.',
          item_no: itemNo
        }, { status: 404 });
      }

      // PDF URL 생성 (base_url 사용)
      const baseUrl = indexCache.base_url || GITHUB_RELEASE_URL;
      const pdfUrl = `${baseUrl}/${note.filename}`;
      
      console.log('✅ Found note for:', itemNo);
      console.log('✅ PDF URL:', pdfUrl);

      return NextResponse.json({
        success: true,
        item_no: itemNo,
        wine_name: note.wine_name,
        pdf_url: pdfUrl,
        size_kb: note.size_kb,
        pages: note.pages,
        updated_at: indexCache.updated_at
      });
    }

    // 전체 목록 조회
    return NextResponse.json({
      success: true,
      version: indexCache.version,
      updated_at: indexCache.updated_at,
      total_count: Object.keys(indexCache.notes || {}).length,
      notes: indexCache.notes
    });

  } catch (error: any) {
    console.error('❌ Tasting notes API error:', error);
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
