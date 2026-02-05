import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * PDF 프록시 API
 * GitHub Release의 PDF를 브라우저에서 바로 볼 수 있도록 중계
 * 
 * GET /api/proxy/pdf?url=https://github.com/.../note/00NV801.pdf
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pdfUrl = searchParams.get('url');

    if (!pdfUrl) {
      return NextResponse.json(
        { error: 'PDF URL이 필요합니다.' },
        { status: 400 }
      );
    }

    // GitHub Release URL 검증
    if (!pdfUrl.includes('github.com') || !pdfUrl.endsWith('.pdf')) {
      return NextResponse.json(
        { error: '올바른 GitHub Release PDF URL이 아닙니다.' },
        { status: 400 }
      );
    }

    console.log('📥 Fetching PDF from GitHub:', pdfUrl);

    // GitHub에서 PDF 다운로드
    const response = await fetch(pdfUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Order-AI/1.0)'
      }
    });

    if (!response.ok) {
      console.error('❌ Failed to fetch PDF:', response.status);
      return NextResponse.json(
        { error: 'PDF를 불러올 수 없습니다.' },
        { status: response.status }
      );
    }

    // PDF 데이터 가져오기
    const pdfBuffer = await response.arrayBuffer();

    console.log('✅ PDF loaded successfully, size:', pdfBuffer.byteLength);

    // PDF를 inline으로 반환 (다운로드가 아닌 브라우저 표시)
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline', // 다운로드 대신 브라우저에서 표시
        'Cache-Control': 'public, max-age=86400', // 24시간 캐시
      }
    });

  } catch (error: any) {
    console.error('❌ PDF proxy error:', error);
    return NextResponse.json(
      { 
        error: 'PDF 프록시 오류',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
