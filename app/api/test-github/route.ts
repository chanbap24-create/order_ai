import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * GitHub 연결 테스트 API
 * GET /api/test-github
 */
export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: []
  };

  // Test 1: Index file
  try {
    const indexUrl = 'https://github.com/chanbap24-create/order_ai/releases/download/note/tasting-notes-index.json';
    const indexResponse = await fetch(`${indexUrl}?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    
    results.tests.push({
      name: 'Index File',
      url: indexUrl,
      status: indexResponse.status,
      ok: indexResponse.ok,
      headers: Object.fromEntries(indexResponse.headers.entries())
    });

    if (indexResponse.ok) {
      const data = await indexResponse.json();
      results.indexData = data;
    }
  } catch (error: any) {
    results.tests.push({
      name: 'Index File',
      error: error.message
    });
  }

  // Test 2: PDF file
  try {
    const pdfUrl = 'https://github.com/chanbap24-create/order_ai/releases/download/note/00NV801.pdf';
    const pdfResponse = await fetch(pdfUrl, {
      method: 'HEAD',
      cache: 'no-store'
    });
    
    results.tests.push({
      name: 'PDF File',
      url: pdfUrl,
      status: pdfResponse.status,
      ok: pdfResponse.ok
    });
  } catch (error: any) {
    results.tests.push({
      name: 'PDF File',
      error: error.message
    });
  }

  return NextResponse.json(results, { status: 200 });
}
