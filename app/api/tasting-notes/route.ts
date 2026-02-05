import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// GitHub Release URL
const GITHUB_RELEASE_URL = 'https://github.com/chanbap24-create/order_ai/releases/download/note';
const INDEX_URL = `${GITHUB_RELEASE_URL}/tasting-notes-index.json`;

// 메모리 캐시 비활성화 (항상 최신 데이터 로드)
let indexCache: any = null;
let cacheTime: number = 0;
const CACHE_DURATION = 0; // 캐시 사용 안 함

/**
 * 테이스팅 노트 인덱스 조회
 * GET /api/tasting-notes
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const itemNo = searchParams.get('item_no');

    // 인덱스 파일 로드 (캐시 사용)
    const now = Date.now();
    if (!indexCache || (now - cacheTime) > CACHE_DURATION) {
      console.log('📥 Loading tasting notes index from GitHub...');
      
      try {
        // 캐시 무효화를 위한 타임스탬프 추가
        const cacheBuster = `?t=${Date.now()}`;
        const fullUrl = `${INDEX_URL}${cacheBuster}`;
        console.log('📥 Loading tasting notes index from:', fullUrl);
        
        const response = await fetch(fullUrl, {
          cache: 'no-store', // 캐시 비활성화
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        
        console.log('📡 Response status:', response.status);
        console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
          console.error('❌ Failed to fetch, status:', response.status);
          throw new Error(`Failed to fetch index: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ Index loaded successfully, items:', Object.keys(data.notes || {}).length);
        
        indexCache = data;
        cacheTime = now;
        console.log('✅ Index loaded successfully');
      } catch (error) {
        console.error('❌ Failed to load tasting notes index:', error);
        
        // 인덱스 파일이 없으면 빈 객체 반환
        return NextResponse.json({
          success: false,
          error: '테이스팅 노트 데이터를 불러올 수 없습니다.',
          message: 'GitHub Release에 tasting-notes-index.json 파일을 업로드해주세요.'
        }, { status: 404 });
      }
    }

    // 특정 품목번호 조회
    if (itemNo) {
      const note = indexCache.notes?.[itemNo];
      
      if (!note || !note.exists) {
        return NextResponse.json({
          success: false,
          error: '해당 품목의 테이스팅 노트가 없습니다.',
          item_no: itemNo
        }, { status: 404 });
      }

      // PDF URL 생성
      const pdfUrl = `${GITHUB_RELEASE_URL}/${note.filename}`;

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
