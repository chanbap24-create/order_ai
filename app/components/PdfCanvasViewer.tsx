'use client';

// PDF를 pdf.js로 직접 캔버스에 그리는 뷰어 — 안드로이드처럼 내장 PDF 뷰어가 없는 브라우저에서도
// 업로드 원본 그대로 화면 안에서 보이게 한다. 한글 CMap·표준 폰트를 함께 지정해 글자 깨짐 방지.
// 정적 자산(워커·CMap·폰트)은 public/pdfjs — scripts/copy-pdfjs-assets.mjs(postinstall)가 생성.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SkeletonBlock } from './ui/Skeleton';

const ASSETS = '/pdfjs';

// actions: 확대 버튼 옆에 같은 줄로 놓을 버튼들(저장 등)
export function PdfCanvasViewer({ url, actions }: { url: string; actions?: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<1 | 2>(1);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    const wrap = wrapRef.current;
    if (!wrap) return;

    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc = `${ASSETS}/pdf.worker.min.mjs`;
        const doc = await pdfjs.getDocument({
          url,
          cMapUrl: `${ASSETS}/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `${ASSETS}/standard_fonts/`,
        }).promise;
        if (cancelled) return;

        wrap.replaceChildren();
        // 기본 = 한 페이지 전체가 보이게(가로·세로 중 빡빡한 쪽에 맞춤). PC는 높이, 폰은 폭이 기준이 된다.
        const availW = wrap.clientWidth;
        const availH = (scrollRef.current?.clientHeight || 0) - 8;
        const dpr = Math.min(window.devicePixelRatio || 1, 3); // 레티나 선명도, 메모리 상한 3x
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const fit = Math.min(availW / base.width, availH > 0 ? availH / base.height : Infinity);
          const cssWidth = base.width * fit * zoom;
          const viewport = page.getViewport({ scale: fit * zoom * dpr });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${cssWidth}px`;
          canvas.style.display = 'block';
          canvas.style.margin = '0 auto 8px';
          canvas.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)';
          canvas.style.background = '#fff';
          wrap.appendChild(canvas);
          await page.render({ canvas, viewport }).promise;
        }
        if (!cancelled) setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();

    return () => { cancelled = true; };
  }, [url, zoom]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
        {actions}
        <button onClick={() => { setState('loading'); setZoom((z) => (z === 1 ? 2 : 1)); }}
          style={{ padding: '5px 12px', borderRadius: 999, border: '1px solid var(--border-default)', background: 'var(--surface)', fontSize: 12, cursor: 'pointer' }}>
          {zoom === 1 ? '확대 2배' : '화면 맞춤'}
        </button>
      </div>
      <div ref={scrollRef} style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'auto', background: 'var(--surface-muted)', borderRadius: 8 }}>
        {state === 'loading' && (
          <div style={{ position: 'absolute', inset: 0, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SkeletonBlock w="60%" h={18} />
            <SkeletonBlock w="100%" h={220} r={6} />
            <SkeletonBlock w="80%" h={14} />
            <SkeletonBlock w="90%" h={14} />
          </div>
        )}
        {state === 'error' && (
          <div style={{ padding: '40px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>
            노트를 표시하지 못했습니다 — 위 PDF 버튼으로 저장해서 확인해주세요
          </div>
        )}
        <div ref={wrapRef} style={{ width: '100%', opacity: state === 'ready' ? 1 : 0, transition: 'opacity 0.2s ease' }} />
      </div>
    </div>
  );
}
