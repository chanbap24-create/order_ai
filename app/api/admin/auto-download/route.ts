import { NextRequest } from 'next/server';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// SSE로 진행상황 실시간 스트리밍
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('mode') || 'all';

  // Node.js 빌트인 모듈을 런타임에 로드 (번들러 우회)
  const cp = await import(/* webpackIgnore: true */ 'node:child_process');
  const path = await import(/* webpackIgnore: true */ 'node:path');
  const fs = await import(/* webpackIgnore: true */ 'node:fs');

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      function send(data: Record<string, unknown>) {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch { /* closed */ }
      }

      const scriptPath = path.join(process.cwd(), 'scripts', 'auto-download.js');
      if (!fs.existsSync(scriptPath)) {
        send({ type: 'error', message: 'auto-download.js not found' });
        controller.close();
        return;
      }

      const args = [scriptPath, '--headless'];
      if (mode === 'cdv-only') args.push('--cdv-only');
      if (mode === 'dl-only') args.push('--dl-only');

      send({ type: 'start', message: 'ABCosmos 자동 다운로드 시작...' });

      const child = cp.spawn('node', args, {
        cwd: process.cwd(),
        env: { ...process.env },
      });

      child.stdout.on('data', (chunk: Buffer) => {
        for (const line of chunk.toString().split('\n').filter(Boolean)) {
          const msg = line.replace(/^\[.*?\]\s*/, '');
          if (line.includes('✓')) send({ type: 'success', message: msg });
          else if (line.includes('✗')) send({ type: 'fail', message: msg });
          else if (line.includes('───')) send({ type: 'progress', message: msg });
          else if (line.includes('═══') || line.includes('성공')) send({ type: 'summary', message: msg });
          else if (line.includes('엔티티') || line.includes('로그인')) send({ type: 'info', message: msg });
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        if (text.includes('Error') || text.includes('error')) {
          send({ type: 'error', message: text.trim().slice(0, 200) });
        }
      });

      child.on('close', (code: number | null) => {
        const dlDir = path.join(process.cwd(), 'downloads');
        const files: string[] = [];
        if (fs.existsSync(dlDir)) {
          const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          for (const f of fs.readdirSync(dlDir)) {
            if (f.includes(today) && f.endsWith('.xlsx')) files.push(f);
          }
        }
        send({
          type: 'done', code, files,
          message: code === 0 ? `완료! ${files.length}개 파일 다운로드됨` : `프로세스 종료 (코드: ${code})`,
        });
        controller.close();
      });

      child.on('error', (err: Error) => {
        send({ type: 'error', message: `프로세스 시작 실패: ${err.message}` });
        controller.close();
      });

      req.signal.addEventListener('abort', () => { child.kill(); });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

// 다운로드된 파일을 클라이언트로 전달
export async function POST(req: NextRequest) {
  const { fileName } = await req.json();
  const path = await import(/* webpackIgnore: true */ 'node:path');
  const fs = await import(/* webpackIgnore: true */ 'node:fs');

  const filePath = path.join(process.cwd(), 'downloads', fileName);
  if (!fs.existsSync(filePath)) {
    return Response.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
}
