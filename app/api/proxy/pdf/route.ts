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
    const forceDownload = searchParams.get('download') === 'true';

    if (!pdfUrl) {
      return NextResponse.json(
        { error: 'URL이 필요합니다.' },
        { status: 400 }
      );
    }

    // SSRF 방지: GitHub 도메인만 허용 (hostname 검증)
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(pdfUrl);
    } catch {
      return NextResponse.json({ error: '올바른 URL 형식이 아닙니다.' }, { status: 400 });
    }
    if (parsedUrl.hostname !== 'github.com' && !parsedUrl.hostname.endsWith('.github.com') && parsedUrl.hostname !== 'objects.githubusercontent.com') {
      return NextResponse.json({ error: '올바른 GitHub Release 파일 URL이 아닙니다.' }, { status: 400 });
    }
    if (parsedUrl.protocol !== 'https:') {
      return NextResponse.json({ error: 'HTTPS URL만 허용됩니다.' }, { status: 400 });
    }
    if (!parsedUrl.pathname.endsWith('.pdf') && !parsedUrl.pathname.endsWith('.pptx')) {
      return NextResponse.json({ error: '올바른 파일 형식이 아닙니다.' }, { status: 400 });
    }

    console.log('📥 Fetching file from GitHub:', pdfUrl);

    // GitHub에서 파일 다운로드
    const response = await fetch(pdfUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Order-AI/1.0)'
      }
    });

    if (!response.ok) {
      console.error('❌ Failed to fetch file:', response.status);
      return NextResponse.json(
        { error: '파일을 불러올 수 없습니다.' },
        { status: response.status }
      );
    }

    // 파일 데이터 가져오기
    const fileBuffer = await response.arrayBuffer();
    
    // 파일 확장자 확인
    const isPdf = pdfUrl.endsWith('.pdf');
    const contentType = isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    const fileName = pdfUrl.split('/').pop() || 'file';

    console.log('✅ File loaded successfully, size:', fileBuffer.byteLength);

    // 다운로드 모드 또는 브라우저 표시 모드
    const contentDisposition = forceDownload 
      ? `attachment; filename="${fileName}"` 
      : 'inline';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
        'Cache-Control': 'public, max-age=86400', // 24시간 캐시
      }
    });

  } catch (error: any) {
    console.error('❌ PDF proxy error:', error);
    return NextResponse.json(
      { error: 'PDF 프록시 오류' },
      { status: 500 }
    );
  }
}
